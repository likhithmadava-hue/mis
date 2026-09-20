//! The one piece of shared state, and the two functions everything goes through.
//!
//! `AppState` holds the open vault, the decrypted database, and the screen-time
//! tracker. Tauri hands it to every command as `State<AppState>`.
//!
//! The vault and the database live behind a **single** mutex rather than one
//! each. Two locks would mean two acquisition orders and eventually a deadlock
//! between a command that reads the database then writes the vault and one that
//! does the reverse. One lock makes that impossible to write.
//!
//! ## The lock
//!
//! Once an account exists the vault is password-protected (see
//! `vault/passkey.rs`), and the app can be in one of three stages:
//!
//! - **Setup** — the vault opens on its own (no account yet); the frontend runs
//!   the onboarding wizard, which ends in [`AppState::setup_account`].
//! - **Locked** — the account exists and nobody has signed in. The database is
//!   *not in memory*: `db` holds an empty placeholder, and [`AppState::read`] and
//!   [`AppState::mutate`] refuse with [`MisError::Locked`]. This is enforced here,
//!   not in the UI — a lock screen that only hid the app would leave every
//!   command one `invoke()` away.
//! - **Unlocked** — signed in; everything works.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::db::{self, types::{DbShape, Profile}};
use crate::error::{MisError, Result};
use crate::screentime::{store::Store, tracker::Tracker};
use crate::vault::{audit, passkey, Protection, Vault};

struct Inner {
    vault: Vault,
    db: DbShape,
    /// Whether `db` is the real database. False while locked, when it is a blank
    /// placeholder that must never be read or written back.
    unlocked: bool,
    /// Whether the vault key is held by a password (true) or by Windows alone.
    password_mode: bool,
}

/// Which screen the app should be showing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Stage {
    Setup,
    Locked,
    Unlocked,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct AuthStatus {
    pub stage: Stage,
}

/// Slows down guessing at the sign-in and recovery forms. Five free tries, then a
/// wait that doubles — 30 s, 60 s, … capped at 15 minutes — and resets on
/// success. It lives in memory only: an attacker who restarts the app to clear
/// it is also an attacker who could copy the vault and guess offline, which is
/// what Argon2's cost is for. This is for the person at the keyboard.
#[derive(Default)]
struct Throttle {
    failures: u32,
    until: Option<Instant>,
}

impl Throttle {
    const FREE_TRIES: u32 = 5;

    fn check(&self) -> Result<()> {
        match self.until {
            Some(t) if Instant::now() < t => {
                Err(MisError::Throttled((t - Instant::now()).as_secs() + 1))
            }
            _ => Ok(()),
        }
    }

    fn fail(&mut self) {
        self.failures += 1;
        if self.failures >= Self::FREE_TRIES {
            let doublings = (self.failures - Self::FREE_TRIES).min(5);
            let secs = (30u64 << doublings).min(900);
            self.until = Some(Instant::now() + Duration::from_secs(secs));
        }
    }

    fn succeed(&mut self) {
        *self = Self::default();
    }
}

pub struct AppState {
    inner: Mutex<Inner>,
    throttle: Mutex<Throttle>,
    pub tracker: Tracker,
}

/// Bring whatever is in the vault forward to the current shape.
///
/// Migrate on raw JSON, before the typed structs see it — an old vault can hold
/// values the current enums will not accept. Only rewrite storage when the
/// migration actually changed something, so opening the app is not itself a
/// vault write. An empty vault becomes a fresh, empty database (not the demo
/// one; see `db/seed.rs`).
fn load_db(vault: &mut Vault) -> Result<DbShape> {
    Ok(match vault.read_raw()? {
        Some(mut raw) => {
            let changed = db::migrations::migrate(&mut raw);
            let db: DbShape = serde_json::from_value(raw).map_err(|e| {
                MisError::Corrupt(format!("the vault opened but its contents could not be read: {e}"))
            })?;
            if changed {
                vault.write_raw(&serde_json::to_value(&db)?)?;
                vault.log_event("migrated", None);
            }
            db
        }
        None => {
            let fresh = db::seed::fresh_db();
            vault.write_raw(&serde_json::to_value(&fresh)?)?;
            fresh
        }
    })
}

impl AppState {
    /// Open the vault, bring its contents forward to the current shape, and get
    /// the tracker ready.
    ///
    /// This is the whole of what `bootStorage()` used to do in the browser
    /// before React mounted — except it now happens before the *window* exists,
    /// so there is no possibility of a component rendering against a database
    /// that has not finished loading. The old code had to be careful about that
    /// ordering; here the type system enforces it, because no command can run
    /// until this function has returned.
    ///
    /// A password-protected vault is **not** opened here. It cannot be — the key
    /// is not on the machine in any form this process can use — so the app starts
    /// locked and the database stays out of memory until sign-in.
    pub fn boot() -> Result<Self> {
        let mut vault = Vault::default();
        vault.ensure_ready()?;

        let password_mode = vault.protection()? == Some(Protection::Password);
        let (db, unlocked) = if password_mode {
            (db::seed::fresh_db(), false)
        } else {
            (load_db(&mut vault)?, true)
        };

        let tracker = Tracker::new(Store::new(vault.screentime_dir()));

        // Dev-only, plain-SQLite mirror of what's in the vault — see
        // `db::dev_mirror` for why this exists and why it is safe. A no-op in
        // release builds. Refreshed here too (not just in `mutate`) so the
        // mirror exists immediately, even before the first edit of a session.
        // Skipped while locked: the placeholder is not anyone's data.
        if unlocked {
            db::dev_mirror::refresh(&vault.dir, &db);
        }

        Ok(Self {
            inner: Mutex::new(Inner { vault, db, unlocked, password_mode }),
            throttle: Mutex::new(Throttle::default()),
            tracker,
        })
    }

    /// A mutex poisoned by a panic elsewhere should not take the rest of the app
    /// down with it — the data behind it is still the data.
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn throttle(&self) -> std::sync::MutexGuard<'_, Throttle> {
        self.throttle.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Read from the database without touching the vault.
    pub fn read<T>(&self, f: impl FnOnce(&DbShape) -> T) -> Result<T> {
        let g = self.lock();
        if !g.unlocked {
            return Err(MisError::Locked);
        }
        Ok(f(&g.db))
    }

    /// Apply a change and seal it to the vault before returning.
    ///
    /// If `f` fails — a write against a locked day, say — nothing is persisted,
    /// because nothing was changed. That is why the closure returns a `Result`
    /// rather than being allowed to mutate and signal failure some other way.
    pub fn mutate<T>(&self, f: impl FnOnce(&mut DbShape) -> Result<T>) -> Result<T> {
        let mut guard = self.lock();
        if !guard.unlocked {
            return Err(MisError::Locked);
        }
        let Inner { vault, db, .. } = &mut *guard;

        // Work on a copy so a failure part-way through cannot leave the
        // in-memory database in a state the vault does not agree with.
        let mut draft = db.clone();
        let out = f(&mut draft)?;

        vault.write_raw(&serde_json::to_value(&draft)?)?;
        db::dev_mirror::refresh(&vault.dir, &draft);
        *db = draft;
        Ok(out)
    }

    pub fn with_vault<T>(&self, f: impl FnOnce(&Vault) -> T) -> Result<T> {
        let g = self.lock();
        if !g.unlocked {
            return Err(MisError::Locked);
        }
        Ok(f(&g.vault))
    }

    /// Note something in the audit log. Never fatal, never blocking — see
    /// `vault/audit.rs`. Works while locked: a failed sign-in is exactly the
    /// kind of thing the log is for.
    pub fn log_event<'a>(&self, event: &str, detail: impl IntoIterator<Item = (&'a str, &'a str)>) {
        let map: audit::Detail = detail
            .into_iter()
            .map(|(k, v)| (k.to_string(), serde_json::Value::String(v.to_string())))
            .collect();
        self.lock()
            .vault
            .log_event(event, if map.is_empty() { None } else { Some(map) });
    }

    // ── Account ─────────────────────────────────────────────────────────────

    pub fn auth_status(&self) -> AuthStatus {
        let g = self.lock();
        AuthStatus {
            stage: match (g.unlocked, g.password_mode) {
                (false, _) => Stage::Locked,
                (true, false) => Stage::Setup,
                (true, true) => Stage::Unlocked,
            },
        }
    }

    /// Finish onboarding: store the profile, then put the vault behind the new
    /// password. Returns the recovery code, which is shown once and kept nowhere.
    ///
    /// Only valid in the Setup stage — once an account exists, credentials change
    /// through [`Self::change_password`] or [`Self::recover`], never by running
    /// setup again over the top.
    ///
    /// The profile is written *first*. If setting the password then fails, the
    /// vault is still in device mode and the wizard can simply be run again; the
    /// reverse order could leave a locked vault with no profile in it.
    pub fn setup_account(&self, profile: Profile, password: &str) -> Result<String> {
        let mut g = self.lock();
        if !g.unlocked || g.password_mode {
            return Err(MisError::Invalid("An account already exists on this device".into()));
        }
        // Everything that can be refused is refused before anything is written.
        let profile = profile.cleaned()?;
        passkey::check_password(password)?;
        let username = profile.username.clone();

        let Inner { vault, db, password_mode, .. } = &mut *g;

        let mut draft = db.clone();
        profile.apply_to(&mut draft.user);
        draft.profile = Some(profile);
        vault.write_raw(&serde_json::to_value(&draft)?)?;
        db::dev_mirror::refresh(&vault.dir, &draft);
        *db = draft;

        let code = vault
            .set_credentials(&username, password, true)?
            .ok_or_else(|| MisError::Vault("no recovery code was issued".into()))?;
        *password_mode = true;
        vault.log_event("account-created", None);
        Ok(code)
    }

    /// Sign in. A wrong username and a wrong password are one failure.
    pub fn login(&self, username: &str, password: &str) -> Result<()> {
        self.throttle().check()?;
        let mut g = self.lock();
        if !g.password_mode {
            return Err(MisError::Invalid("No account is set up on this device yet".into()));
        }
        if g.unlocked {
            return Ok(());
        }
        let Inner { vault, db, unlocked, .. } = &mut *g;

        match vault.unlock(username, password) {
            Ok(()) => {}
            Err(MisError::BadCredentials) => {
                vault.log_event("sign-in-failed", None);
                self.throttle().fail();
                return Err(MisError::BadCredentials);
            }
            Err(e) => return Err(e),
        }
        // The key is right but the vault may still be unreadable (damaged, or
        // from a newer MIS). Stay locked rather than half-open.
        match load_db(vault) {
            Ok(loaded) => {
                *db = loaded;
                *unlocked = true;
            }
            Err(e) => {
                vault.lock();
                return Err(e);
            }
        }
        self.throttle().succeed();
        vault.log_event("sign-in", None);
        Ok(())
    }

    /// Lock the app again without quitting: forget the key and drop the database
    /// from memory.
    pub fn lock_app(&self) -> Result<()> {
        let mut g = self.lock();
        if !g.password_mode {
            return Err(MisError::Invalid("Set up an account before locking MIS".into()));
        }
        let Inner { vault, db, unlocked, .. } = &mut *g;
        vault.lock();
        *db = db::seed::fresh_db();
        *unlocked = false;
        vault.log_event("locked", None);
        Ok(())
    }

    /// Reset a forgotten password with the recovery code. Signs the person in,
    /// retires the code that was used, and returns its replacement.
    ///
    /// The username is read back out of the vault's own profile: whoever holds
    /// the code has just proved they can read the vault, so there is nothing to
    /// gain by making them remember it as well.
    pub fn recover(&self, code: &str, new_password: &str) -> Result<String> {
        // Refuse a bad new password before spending an attempt on the code.
        passkey::check_password(new_password)?;
        self.throttle().check()?;
        let mut g = self.lock();
        if !g.password_mode {
            return Err(MisError::Invalid("No account is set up on this device yet".into()));
        }
        let Inner { vault, db, unlocked, .. } = &mut *g;

        match vault.recover(code) {
            Ok(()) => {}
            Err(MisError::BadRecoveryCode) => {
                vault.log_event("recovery-failed", None);
                self.throttle().fail();
                return Err(MisError::BadRecoveryCode);
            }
            Err(e) => return Err(e),
        }

        let result = (|| {
            let loaded = load_db(vault)?;
            let username = loaded
                .profile
                .as_ref()
                .map(|p| p.username.clone())
                .ok_or_else(|| MisError::Corrupt("this vault has no profile to recover into".into()))?;
            let new_code = vault
                .set_credentials(&username, new_password, true)?
                .ok_or_else(|| MisError::Vault("no recovery code was issued".into()))?;
            Ok::<_, MisError>((loaded, new_code))
        })();

        match result {
            Ok((loaded, new_code)) => {
                *db = loaded;
                *unlocked = true;
                self.throttle().succeed();
                vault.log_event("password-reset", None);
                Ok(new_code)
            }
            Err(e) => {
                vault.lock();
                Err(e)
            }
        }
    }

    /// Change the password while signed in. The current one is asked for again,
    /// so an unattended, unlocked window is not enough to take the account over.
    pub fn change_password(&self, current: &str, new_password: &str) -> Result<()> {
        passkey::check_password(new_password)?;
        self.throttle().check()?;
        let mut g = self.lock();
        let username = Self::signed_in_username(&g)?;
        self.verify_current(&mut g, &username, current)?;
        g.vault.set_credentials(&username, new_password, false)?;
        g.vault.log_event("password-changed", None);
        Ok(())
    }

    /// Issue a fresh recovery code (retiring the old one). Needs the password.
    pub fn new_recovery_code(&self, current: &str) -> Result<String> {
        self.throttle().check()?;
        let mut g = self.lock();
        let username = Self::signed_in_username(&g)?;
        self.verify_current(&mut g, &username, current)?;
        let code = g
            .vault
            .set_credentials(&username, current, true)?
            .ok_or_else(|| MisError::Vault("no recovery code was issued".into()))?;
        g.vault.log_event("recovery-code-renewed", None);
        Ok(code)
    }

    fn signed_in_username(g: &Inner) -> Result<String> {
        if !g.unlocked {
            return Err(MisError::Locked);
        }
        if !g.password_mode {
            return Err(MisError::Invalid("Set up an account first".into()));
        }
        g.db
            .profile
            .as_ref()
            .map(|p| p.username.clone())
            .ok_or_else(|| MisError::Corrupt("this vault has no profile".into()))
    }

    fn verify_current(&self, g: &mut Inner, username: &str, password: &str) -> Result<()> {
        match g.vault.verify_password(username, password) {
            Ok(()) => {
                self.throttle().succeed();
                Ok(())
            }
            Err(MisError::BadCredentials) => {
                self.throttle().fail();
                Err(MisError::BadCredentials)
            }
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn five_free_tries_then_a_wait_that_grows() {
        let mut t = Throttle::default();
        for _ in 0..4 {
            t.fail();
            assert!(t.check().is_ok(), "the first tries must not be slowed");
        }
        t.fail(); // the fifth
        assert!(matches!(t.check(), Err(MisError::Throttled(s)) if (1..=31).contains(&s)));

        let first = t.until.unwrap();
        t.fail();
        assert!(t.until.unwrap() > first + Duration::from_secs(29), "the wait grows");
    }

    #[test]
    fn the_wait_is_capped() {
        let mut t = Throttle::default();
        for _ in 0..40 {
            t.fail();
        }
        assert!(matches!(t.check(), Err(MisError::Throttled(s)) if s <= 901));
    }

    #[test]
    fn a_success_forgives_everything() {
        let mut t = Throttle::default();
        for _ in 0..8 {
            t.fail();
        }
        t.succeed();
        assert!(t.check().is_ok());
        assert_eq!(t.failures, 0);
    }
}
