//! The encrypted vault: the authoritative store for all MIS data on this device.
//!
//! ```text
//! %LOCALAPPDATA%\MIS\
//!   vault.mis    the database, AES-256-GCM encrypted (any edit makes it fail
//!                to decrypt, which is what "tamper-evident" means here)
//!   vault.key    the 32-byte data key, wrapped twice — once with Windows DPAPI
//!                so only this Windows user can open it, once with the developer
//!                recovery public key
//!   audit.log    the hash-chained write log
//!   README.txt   a plain-language note for whoever finds the folder
//!   screentime/  one sealed file per day
//! ```
//!
//! ## What changed, and what deliberately did not
//!
//! The file format is **unchanged** from the Python host. Same directory, same
//! JSON envelopes, same AAD, same recovery key. A vault written by the old app
//! opens in this one and vice versa, because the alternative was orphaning data
//! that already exists on this machine.
//!
//! What is gone is the *transport*. The old design served the vault over
//! loopback HTTP to a browser window, which meant a random port, a per-launch
//! token spliced into `index.html`, and a real risk that any other local program
//! could read the vault if that token ever leaked. Tauri's IPC bridge replaces
//! all of it: the frontend and the vault are the same process, there is no
//! socket to find, and `X-MIS-Token` no longer exists because there is nothing
//! left to authenticate.
//!
//! ## Two ways the data key can be held
//!
//! **Device mode** (the original, and a fresh install until the account is set
//! up): `vault.key` carries a DPAPI wrap, so anyone signed in to this Windows
//! account opens the vault with no further step.
//!
//! **Password mode** (after onboarding): the DPAPI wrap is *deleted* and the key
//! is held by a password wrap and a recovery-code wrap instead — see
//! [`passkey`]. Deleting it is the point. If the DPAPI wrap stayed, the lock
//! screen would be a curtain in front of an unlocked door: any program running
//! as you could still unwrap the key and read the vault without the password.
//! In password mode the vault cannot be opened without a secret only the person
//! holds.
//!
//! The developer recovery wrap is kept in both modes, exactly as before.
//!
//! ## Honest limits
//!
//! In device mode this protects the data from *other Windows users*, from being
//! read on *another PC*, and from *silent tampering*, and cannot hide it from
//! the person logged in at this keyboard. Password mode adds a real barrier
//! against that person's *unattended session* and against malware running as
//! them — but not against someone who watches the password being typed, and not
//! against an administrator who reads the process's memory while MIS is
//! unlocked. Screen-time files stay DPAPI-sealed in both modes. Do not let the UI
//! claim otherwise.

pub mod audit;
pub mod crypto;
pub mod dpapi;
pub mod passkey;
pub mod recovery_key;

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use zeroize::Zeroizing;

use crate::error::{MisError, Result};

pub const APP_DIR_NAME: &str = "MIS";

#[cfg(debug_assertions)]
const README_TEXT: &str = "\
This folder holds your MIS (Mistake Intelligence System) data.

  vault.mis   your data, encrypted (AES-256-GCM)
  vault.key   the encryption key, sealed so only your Windows account can
              open it on this computer
  audit.log   a tamper-evident log of writes
  screentime  one sealed file per day of app usage
  mis-dev.db  a plain, unencrypted mirror of vault.mis, for development
              only — a debug build of MIS writes it so a developer can
              open it in an ordinary SQLite viewer. It only ever appears
              in a debug build; an installed copy of MIS never creates
              it. The app only ever writes this file, never reads it, so
              unlike the others it is harmless to delete or inspect — it
              is simply rebuilt on the next save.

Everything stays on this device. Nothing is uploaded anywhere.

Do not edit or delete vault.mis, vault.key, audit.log, or screentime by
hand — the app manages them, and a hand edit will make the data
unreadable. To back up MIS, copy this whole folder somewhere safe.
";

#[cfg(not(debug_assertions))]
const README_TEXT: &str = "\
This folder holds your MIS (Mistake Intelligence System) data.

  vault.mis   your data, encrypted (AES-256-GCM)
  vault.key   the encryption key, sealed so only your Windows account can
              open it on this computer
  audit.log   a tamper-evident log of writes
  screentime  one sealed file per day of app usage

Everything stays on this device. Nothing is uploaded anywhere.

Do not edit or delete these files by hand — the app manages them, and a
hand edit will make the data unreadable. To back up MIS, copy this whole
folder somewhere safe.
";

/// The per-user encrypted data folder, created if missing.
///
/// Under `%LOCALAPPDATA%` rather than a fixed drive letter, because it has to be
/// created on *any* user's device and a particular drive may not exist there.
/// Every Windows account has LOCALAPPDATA. This matters more now than it did:
/// the app is an installer that strangers download, not a folder on D:.
pub fn vault_dir() -> PathBuf {
    let root = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|| dirs_home().map(|h| h.join("AppData").join("Local")))
        .unwrap_or_else(std::env::temp_dir);
    let dir = root.join(APP_DIR_NAME);
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE").map(PathBuf::from)
}

/// The `vault.key` envelope — the shape Python wrote, field for field.
#[derive(Debug, Serialize, Deserialize)]
struct KeyRecord {
    v: u32,
    alg: String,
    wrap: KeyWraps,
    created: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct KeyWraps {
    /// The data key sealed to this Windows user. The everyday way in — and, once
    /// a password is set, **absent**: see the module docs for why it is removed
    /// rather than ignored.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    dpapi: Option<String>,
    /// The same key under the developer recovery public key. The way back in
    /// after a Windows reinstall, when the DPAPI wrap is gone forever.
    dev: String,
    dev_key_id: String,
    /// The key under the account password. Present only in password mode.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pass: Option<passkey::PassWrap>,
    /// The key under the recovery code, for a forgotten password.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    recovery: Option<passkey::RecoveryWrap>,
}

/// How the data key is currently held.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Protection {
    /// Sealed to the Windows user; opens automatically.
    Device,
    /// Sealed to a password; opens only after sign-in.
    Password,
}

/// The `vault.mis` envelope.
#[derive(Debug, Serialize, Deserialize)]
struct DataBlob {
    v: u32,
    nonce: String,
    ct: String,
    aad: String,
}

pub struct Vault {
    pub dir: PathBuf,
    pub data_path: PathBuf,
    pub key_path: PathBuf,
    pub audit_path: PathBuf,
    /// Cached data key for this process. `Zeroizing` wipes it on drop so the
    /// key does not linger in freed memory after the app closes.
    data_key: Option<Zeroizing<Vec<u8>>>,
}

impl Default for Vault {
    fn default() -> Self {
        Self::new(vault_dir())
    }
}

impl Vault {
    pub fn new(dir: PathBuf) -> Self {
        Self {
            data_path: dir.join("vault.mis"),
            key_path: dir.join("vault.key"),
            audit_path: dir.join("audit.log"),
            dir,
            data_key: None,
        }
    }

    pub fn screentime_dir(&self) -> PathBuf {
        let d = self.dir.join("screentime");
        let _ = std::fs::create_dir_all(&d);
        d
    }

    // ── Key management ──────────────────────────────────────────────────────

    fn create_key(&mut self) -> Result<Zeroizing<Vec<u8>>> {
        let dk = crypto::new_data_key();

        let record = KeyRecord {
            v: crypto::KEY_VERSION,
            alg: "AES-256-GCM".into(),
            wrap: KeyWraps {
                dpapi: Some(crypto::b64_encode(&dpapi::protect(&dk, crypto::AAD)?)),
                dev: crypto::wrap_for_recovery(&dk)?,
                dev_key_id: crypto::recovery_key_id(),
                pass: None,
                recovery: None,
            },
            created: chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%z").to_string(),
        };

        write_atomic(&self.key_path, serde_json::to_string_pretty(&record)?.as_bytes())?;
        let _ = audit::append(&self.audit_path, "key-created", dk.len() as u64, None);

        Ok(Zeroizing::new(dk.to_vec()))
    }

    fn load_key(&mut self) -> Result<Zeroizing<Vec<u8>>> {
        if let Some(k) = &self.data_key {
            return Ok(k.clone());
        }
        let key = if self.key_path.exists() {
            let record = self.read_record()?;
            // No DPAPI wrap means password mode: the key is not ours to fetch.
            // `Locked`, not a decryption error — nothing is wrong, nobody has
            // signed in yet.
            let Some(sealed) = record.wrap.dpapi else {
                return Err(MisError::Locked);
            };
            Zeroizing::new(dpapi::unprotect(&crypto::b64_decode(&sealed)?, crypto::AAD)?)
        } else {
            self.create_key()?
        };
        self.data_key = Some(key.clone());
        Ok(key)
    }

    fn read_record(&self) -> Result<KeyRecord> {
        Ok(serde_json::from_str(&std::fs::read_to_string(&self.key_path)?)?)
    }

    fn write_record(&self, record: &KeyRecord) -> Result<()> {
        write_atomic(&self.key_path, serde_json::to_string_pretty(record)?.as_bytes())
    }

    // ── Password mode ───────────────────────────────────────────────────────

    /// How the key is held right now, or `None` before any key exists.
    pub fn protection(&self) -> Result<Option<Protection>> {
        if !self.key_path.exists() {
            return Ok(None);
        }
        Ok(Some(if self.read_record()?.wrap.dpapi.is_some() {
            Protection::Device
        } else {
            Protection::Password
        }))
    }

    /// Whether the data key is in memory — i.e. whether the vault can be read.
    pub fn is_unlocked(&self) -> bool {
        self.data_key.is_some()
    }

    /// Forget the key. The vault cannot be read again until [`Self::unlock`] or
    /// [`Self::recover`]. (`Zeroizing` wipes it as it drops.)
    pub fn lock(&mut self) {
        self.data_key = None;
    }

    /// Open a password-mode vault. A wrong username and a wrong password are the
    /// same failure; see [`passkey`].
    pub fn unlock(&mut self, username: &str, password: &str) -> Result<()> {
        let record = self.read_record()?;
        let Some(wrap) = record.wrap.pass else {
            return Err(MisError::Invalid("This vault has no password set".into()));
        };
        self.data_key = Some(passkey::unwrap_with_password(&wrap, username, password)?);
        Ok(())
    }

    /// Check a password without changing what is unlocked.
    pub fn verify_password(&self, username: &str, password: &str) -> Result<()> {
        let wrap = self
            .read_record()?
            .wrap
            .pass
            .ok_or_else(|| MisError::Invalid("This vault has no password set".into()))?;
        passkey::unwrap_with_password(&wrap, username, password).map(|_| ())
    }

    /// Open the vault with the recovery code instead of the password.
    pub fn recover(&mut self, code: &str) -> Result<()> {
        let record = self.read_record()?;
        let Some(wrap) = record.wrap.recovery else {
            return Err(MisError::Invalid("This vault has no recovery code".into()));
        };
        self.data_key = Some(passkey::unwrap_with_code(&wrap, code)?);
        Ok(())
    }

    /// Put the vault in password mode, or change its credentials.
    ///
    /// The one operation behind first-time setup, a password change and a
    /// recovery reset: it needs the data key already in memory (DPAPI, a
    /// sign-in, or the recovery code), rewrites the password wrap, deletes the
    /// DPAPI wrap, and — when `new_recovery_code` — mints a fresh recovery code
    /// and retires the old one. Everything lands in **one** atomic write of
    /// `vault.key`, so a crash leaves either the old credentials or the new,
    /// never a vault with neither.
    ///
    /// Returns the new recovery code when one was made. It is shown to the
    /// person once and never stored.
    pub fn set_credentials(
        &mut self,
        username: &str,
        password: &str,
        new_recovery_code: bool,
    ) -> Result<Option<String>> {
        self.set_credentials_with(username, password, new_recovery_code, passkey::KdfParams::interactive())
    }

    fn set_credentials_with(
        &mut self,
        username: &str,
        password: &str,
        new_recovery_code: bool,
        params: passkey::KdfParams,
    ) -> Result<Option<String>> {
        if passkey::normalise_username(username).is_empty() {
            return Err(MisError::Invalid("Choose a username".into()));
        }
        passkey::check_password(password)?;

        let key = self.load_key()?;
        let mut record = self.read_record()?;

        record.wrap.pass = Some(passkey::wrap_with_password(&key, username, password, params)?);
        record.wrap.dpapi = None;

        // A vault that has never had a recovery code needs one whether or not the
        // caller asked; otherwise a forgotten password would strand it.
        let code = (new_recovery_code || record.wrap.recovery.is_none())
            .then(passkey::new_recovery_code);
        if let Some(code) = &code {
            record.wrap.recovery = Some(passkey::wrap_with_code(&key, code)?);
        }

        self.write_record(&record)?;
        Ok(code)
    }

    // ── Data ────────────────────────────────────────────────────────────────

    /// The decrypted database as raw JSON, or `None` if the vault is empty.
    ///
    /// Raw rather than typed on purpose: `migrations::migrate` has to rewrite
    /// old *values* (a `"Silly Mistake"` that no longer parses) before the typed
    /// structs ever see them.
    pub fn read_raw(&mut self) -> Result<Option<Value>> {
        if !self.data_path.exists() {
            return Ok(None);
        }
        let key = self.load_key()?;
        let blob: DataBlob = serde_json::from_str(&std::fs::read_to_string(&self.data_path)?)?;
        let plaintext = crypto::open(
            &key,
            &crypto::b64_decode(&blob.nonce)?,
            &crypto::b64_decode(&blob.ct)?,
        )?;
        Ok(Some(serde_json::from_slice(&plaintext)?))
    }

    /// Encrypt and store the database.
    ///
    /// The write is atomic — a temp file then a rename — so a crash or a pulled
    /// power cable can never leave a half-written vault, which would be
    /// indistinguishable from a tampered one and just as unopenable.
    pub fn write_raw(&mut self, db: &Value) -> Result<()> {
        let key = self.load_key()?;
        let plaintext = serde_json::to_vec(db)?;
        let (nonce, ct) = crypto::seal(&key, &plaintext)?;

        let blob = DataBlob {
            v: 1,
            nonce: crypto::b64_encode(&nonce),
            ct: crypto::b64_encode(&ct),
            aad: String::from_utf8_lossy(crypto::AAD).into_owned(),
        };
        write_atomic(&self.data_path, serde_json::to_string(&blob)?.as_bytes())?;

        // Swallowed on purpose: the audit log is evidence about your data, not
        // your data. Failing to write evidence must never cost you the day.
        if let Err(e) = audit::append(&self.audit_path, "write", plaintext.len() as u64, None) {
            eprintln!("[mis] audit append failed (data was saved): {e}");
        }
        Ok(())
    }

    /// Record something the app did, for the audit log. Never fatal.
    pub fn log_event(&self, event: &str, detail: Option<audit::Detail>) {
        if let Err(e) = audit::append(&self.audit_path, event, 0, detail) {
            eprintln!("[mis] audit append failed for '{event}': {e}");
        }
    }

    // ── First-run setup ─────────────────────────────────────────────────────

    /// Create the key on first run, drop a README, and lock the folder down.
    pub fn ensure_ready(&mut self) -> Result<()> {
        // A password-mode vault stays shut: fetching its key here is exactly
        // what the lock exists to prevent.
        if self.protection()? != Some(Protection::Password) {
            self.load_key()?;
        }
        let readme = self.dir.join("README.txt");
        if !readme.exists() {
            let _ = std::fs::write(&readme, README_TEXT);
        }
        self.harden();
        Ok(())
    }

    /// Best-effort: restrict the folder's ACL to the current user and SYSTEM, so
    /// another non-admin account on the same PC cannot even read the files.
    ///
    /// Silently ignored if `icacls` is unavailable or refuses. The DPAPI seal is
    /// the real guarantee; this is defence in depth.
    fn harden(&self) {
        let Some(user) = std::env::var_os("USERNAME") else { return };
        let Some(user) = user.to_str() else { return };

        let mut cmd = std::process::Command::new("icacls");
        cmd.arg(&self.dir)
            .arg("/inheritance:r")
            .arg("/grant:r")
            .arg(format!("{user}:(OI)(CI)F"))
            .arg("/grant:r")
            .arg("SYSTEM:(OI)(CI)F");

        // Without this an installed, windowless app flashes a console for a
        // fraction of a second on every launch.
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let _ = cmd.output();
    }

    /// Whether the audit chain is intact, and where it first breaks if not.
    pub fn audit_status(&self) -> (bool, Option<u64>) {
        let broken_at = audit::first_break(&self.audit_path);
        (broken_at.is_none(), broken_at)
    }
}

/// Write a file atomically: fully to a sibling temp file, then rename over the
/// target. On Windows `rename` replaces an existing file, so the target is
/// always either the old contents or the new ones — never a mixture.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!(
        "{}tmp",
        path.extension().map(|e| format!("{}.", e.to_string_lossy())).unwrap_or_default()
    ));
    std::fs::write(&tmp, bytes)
        .map_err(|e| MisError::Vault(format!("could not write {}: {e}", tmp.display())))?;
    std::fs::rename(&tmp, path)
        .map_err(|e| MisError::Vault(format!("could not replace {}: {e}", path.display())))?;
    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_vault(name: &str) -> Vault {
        let dir = std::env::temp_dir().join(format!("mis-vault-test-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Vault::new(dir)
    }

    #[test]
    fn an_empty_vault_reads_as_nothing_rather_than_erroring() {
        let mut v = temp_vault("empty");
        assert!(v.read_raw().unwrap().is_none());
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn what_goes_in_comes_back_out() {
        let mut v = temp_vault("roundtrip");
        let db = json!({ "app_mode": "life", "daily_metrics": [{ "date": "2026-08-03" }] });
        v.write_raw(&db).unwrap();
        assert_eq!(v.read_raw().unwrap().unwrap(), db);
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn the_file_on_disk_is_not_readable_as_plain_text() {
        let mut v = temp_vault("opaque");
        v.write_raw(&json!({ "secret_subject": "Physics" })).unwrap();
        let raw = std::fs::read_to_string(&v.data_path).unwrap();
        assert!(!raw.contains("Physics"), "the vault body must not be legible on disk");
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn editing_the_vault_file_by_hand_is_caught_on_the_next_read() {
        let mut v = temp_vault("tampered");
        v.write_raw(&json!({ "study_hours": 5 })).unwrap();

        // Flip one base64 character of the ciphertext.
        let raw = std::fs::read_to_string(&v.data_path).unwrap();
        let mut blob: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let ct = blob["ct"].as_str().unwrap().to_string();
        let swapped = if ct.starts_with('A') { format!("B{}", &ct[1..]) } else { format!("A{}", &ct[1..]) };
        blob["ct"] = json!(swapped);
        std::fs::write(&v.data_path, blob.to_string()).unwrap();

        v.data_key = None; // force a fresh open, as a new launch would
        assert!(matches!(v.read_raw(), Err(MisError::Corrupt(_))));
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn every_write_is_recorded_in_the_audit_chain() {
        let mut v = temp_vault("audited");
        v.write_raw(&json!({ "n": 1 })).unwrap();
        v.write_raw(&json!({ "n": 2 })).unwrap();

        let (intact, broken_at) = v.audit_status();
        assert!(intact);
        assert_eq!(broken_at, None);
        // key-created, then two writes.
        assert_eq!(audit::recent(&v.audit_path, 10).len(), 3);
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    // ── Password mode ───────────────────────────────────────────────────────

    const CHEAP: passkey::KdfParams = passkey::KdfParams::cheap();

    /// A vault holding `{"n":1}`, switched to password mode. Returns the vault
    /// dir and the recovery code that was issued.
    fn locked_vault(name: &str) -> (Vault, String) {
        let mut v = temp_vault(name);
        v.write_raw(&json!({ "n": 1 })).unwrap();
        let code = v
            .set_credentials_with("Vohrim", "correct horse", true, CHEAP)
            .unwrap()
            .expect("first setup must issue a recovery code");
        (v, code)
    }

    /// What a fresh launch sees: a new `Vault` over the same folder, no key in
    /// memory.
    fn relaunch(v: &Vault) -> Vault {
        Vault::new(v.dir.clone())
    }

    #[test]
    fn a_new_vault_starts_in_device_mode() {
        let mut v = temp_vault("device-mode");
        assert_eq!(v.protection().unwrap(), None);
        v.write_raw(&json!({})).unwrap();
        assert_eq!(v.protection().unwrap(), Some(Protection::Device));
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn setting_a_password_removes_the_dpapi_wrap_from_disk() {
        let (v, _) = locked_vault("no-dpapi");
        assert_eq!(v.protection().unwrap(), Some(Protection::Password));
        let raw = std::fs::read_to_string(&v.key_path).unwrap();
        assert!(!raw.contains("\"dpapi\""), "the DPAPI wrap must be gone, not just unused");
        assert!(raw.contains("\"pass\"") && raw.contains("\"recovery\"") && raw.contains("\"dev\""));
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn a_locked_vault_cannot_be_read_without_signing_in() {
        // The whole reason for deleting the DPAPI wrap: a fresh process that is
        // the same Windows user still cannot open it.
        let (v, _) = locked_vault("stays-shut");
        let mut fresh = relaunch(&v);
        assert!(matches!(fresh.read_raw(), Err(MisError::Locked)));
        assert!(fresh.ensure_ready().is_ok(), "opening the app must not fetch the key");
        assert!(!fresh.is_unlocked());
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn the_right_credentials_open_the_same_data() {
        let (v, _) = locked_vault("sign-in");
        let mut fresh = relaunch(&v);
        fresh.unlock("vohrim", "correct horse").unwrap();
        assert_eq!(fresh.read_raw().unwrap().unwrap(), json!({ "n": 1 }));
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn wrong_credentials_leave_it_locked() {
        let (v, _) = locked_vault("bad-sign-in");
        let mut fresh = relaunch(&v);
        assert!(matches!(fresh.unlock("vohrim", "wrong"), Err(MisError::BadCredentials)));
        assert!(matches!(fresh.unlock("nobody", "correct horse"), Err(MisError::BadCredentials)));
        assert!(!fresh.is_unlocked());
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn locking_forgets_the_key() {
        let (mut v, _) = locked_vault("re-lock");
        v.unlock("vohrim", "correct horse").unwrap();
        assert!(v.read_raw().is_ok());
        v.lock();
        assert!(matches!(v.read_raw(), Err(MisError::Locked)));
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn the_recovery_code_opens_the_vault_and_a_reset_retires_it() {
        let (v, old_code) = locked_vault("recovery");
        let mut fresh = relaunch(&v);
        fresh.recover(&old_code).unwrap();
        assert_eq!(fresh.read_raw().unwrap().unwrap(), json!({ "n": 1 }));

        let new_code = fresh
            .set_credentials_with("vohrim", "a brand new password", true, CHEAP)
            .unwrap()
            .unwrap();
        assert_ne!(new_code, old_code);

        let mut after = relaunch(&v);
        assert!(after.recover(&old_code).is_err(), "the used code must stop working");
        assert!(after.unlock("vohrim", "correct horse").is_err(), "so must the old password");
        after.unlock("vohrim", "a brand new password").unwrap();
        after.recover(&new_code).unwrap();
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn changing_the_password_keeps_the_existing_recovery_code() {
        let (mut v, code) = locked_vault("change-pw");
        v.unlock("vohrim", "correct horse").unwrap();
        let issued = v.set_credentials_with("vohrim", "another password", false, CHEAP).unwrap();
        assert!(issued.is_none(), "no new code was asked for");

        let mut fresh = relaunch(&v);
        fresh.unlock("vohrim", "another password").unwrap();
        fresh.recover(&code).unwrap();
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn the_developer_recovery_wrap_survives_password_mode() {
        let (v, _) = locked_vault("dev-wrap");
        let raw = std::fs::read_to_string(&v.key_path).unwrap();
        let rec: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert!(rec["wrap"]["dev"].as_str().is_some_and(|s| !s.is_empty()));
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn weak_credentials_are_refused_before_anything_is_written() {
        let mut v = temp_vault("weak");
        v.write_raw(&json!({})).unwrap();
        let before = std::fs::read_to_string(&v.key_path).unwrap();
        assert!(v.set_credentials_with("me", "short", true, CHEAP).is_err());
        assert!(v.set_credentials_with("  ", "long enough pw", true, CHEAP).is_err());
        assert_eq!(std::fs::read_to_string(&v.key_path).unwrap(), before);
        assert_eq!(v.protection().unwrap(), Some(Protection::Device));
        let _ = std::fs::remove_dir_all(&v.dir);
    }

    #[test]
    fn a_second_open_reuses_the_same_key_rather_than_minting_one() {
        let mut v = temp_vault("stable-key");
        v.write_raw(&json!({ "n": 1 })).unwrap();

        let mut reopened = Vault::new(v.dir.clone());
        assert_eq!(reopened.read_raw().unwrap().unwrap(), json!({ "n": 1 }));
        let _ = std::fs::remove_dir_all(&v.dir);
    }
}
