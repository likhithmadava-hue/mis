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
//! ## Honest limits
//!
//! This protects the data from *other Windows users*, from being read on
//! *another PC*, and from *silent tampering*. It cannot hide data from the
//! person logged in at this keyboard, nor from an administrator — no purely
//! local app can, and this one does not pretend to. Do not let the UI claim
//! otherwise.

pub mod audit;
pub mod crypto;
pub mod dpapi;
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
    /// The data key sealed to this Windows user. The everyday way in.
    dpapi: String,
    /// The same key under the developer recovery public key. The way back in
    /// after a Windows reinstall, when the DPAPI wrap is gone forever.
    dev: String,
    dev_key_id: String,
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
                dpapi: crypto::b64_encode(&dpapi::protect(&dk, crypto::AAD)?),
                dev: crypto::wrap_for_recovery(&dk)?,
                dev_key_id: crypto::recovery_key_id(),
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
            let record: KeyRecord = serde_json::from_str(&std::fs::read_to_string(&self.key_path)?)?;
            let sealed = crypto::b64_decode(&record.wrap.dpapi)?;
            Zeroizing::new(dpapi::unprotect(&sealed, crypto::AAD)?)
        } else {
            self.create_key()?
        };
        self.data_key = Some(key.clone());
        Ok(key)
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
        self.load_key()?;
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

    #[test]
    fn a_second_open_reuses_the_same_key_rather_than_minting_one() {
        let mut v = temp_vault("stable-key");
        v.write_raw(&json!({ "n": 1 })).unwrap();

        let mut reopened = Vault::new(v.dir.clone());
        assert_eq!(reopened.read_raw().unwrap().unwrap(), json!({ "n": 1 }));
        let _ = std::fs::remove_dir_all(&v.dir);
    }
}
