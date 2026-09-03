//! The one piece of shared state, and the two functions everything goes through.
//!
//! `AppState` holds the open vault, the decrypted database, and the screen-time
//! tracker. Tauri hands it to every command as `State<AppState>`.
//!
//! The vault and the database live behind a **single** mutex rather than one
//! each. Two locks would mean two acquisition orders and eventually a deadlock
//! between a command that reads the database then writes the vault and one that
//! does the reverse. One lock makes that impossible to write.

use std::sync::Mutex;

use crate::db::{self, types::DbShape};
use crate::error::{MisError, Result};
use crate::screentime::{store::Store, tracker::Tracker};
use crate::vault::{audit, Vault};

struct Inner {
    vault: Vault,
    db: DbShape,
}

pub struct AppState {
    inner: Mutex<Inner>,
    pub tracker: Tracker,
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
    pub fn boot() -> Result<Self> {
        let mut vault = Vault::default();
        vault.ensure_ready()?;

        let db = match vault.read_raw()? {
            Some(mut raw) => {
                // Migrate on raw JSON, before the typed structs see it — an old
                // vault can hold values the current enums will not accept.
                let changed = db::migrations::migrate(&mut raw);
                let db: DbShape = serde_json::from_value(raw.clone()).map_err(|e| {
                    MisError::Corrupt(format!(
                        "the vault opened but its contents could not be read: {e}"
                    ))
                })?;
                // Only rewrite storage when the migration actually changed
                // something, so opening the app is not itself a vault write.
                if changed {
                    vault.write_raw(&serde_json::to_value(&db)?)?;
                    vault.log_event("migrated", None);
                }
                db
            }
            None => {
                // First launch: an empty database, not the demo one. See
                // `db/seed.rs` for why.
                let fresh = db::seed::fresh_db();
                vault.write_raw(&serde_json::to_value(&fresh)?)?;
                fresh
            }
        };

        let tracker = Tracker::new(Store::new(vault.screentime_dir()));

        // Dev-only, plain-SQLite mirror of what's in the vault — see
        // `db::dev_mirror` for why this exists and why it is safe. A no-op in
        // release builds. Refreshed here too (not just in `mutate`) so the
        // mirror exists immediately, even before the first edit of a session.
        db::dev_mirror::refresh(&vault.dir, &db);

        Ok(Self {
            inner: Mutex::new(Inner { vault, db }),
            tracker,
        })
    }

    /// A mutex poisoned by a panic elsewhere should not take the rest of the app
    /// down with it — the data behind it is still the data.
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Read from the database without touching the vault.
    pub fn read<T>(&self, f: impl FnOnce(&DbShape) -> T) -> Result<T> {
        Ok(f(&self.lock().db))
    }

    /// Apply a change and seal it to the vault before returning.
    ///
    /// If `f` fails — a write against a locked day, say — nothing is persisted,
    /// because nothing was changed. That is why the closure returns a `Result`
    /// rather than being allowed to mutate and signal failure some other way.
    pub fn mutate<T>(&self, f: impl FnOnce(&mut DbShape) -> Result<T>) -> Result<T> {
        let mut guard = self.lock();
        let Inner { vault, db } = &mut *guard;

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
        Ok(f(&self.lock().vault))
    }

    /// Note something in the audit log. Never fatal, never blocking — see
    /// `vault/audit.rs`.
    pub fn log_event<'a>(&self, event: &str, detail: impl IntoIterator<Item = (&'a str, &'a str)>) {
        let map: audit::Detail = detail
            .into_iter()
            .map(|(k, v)| (k.to_string(), serde_json::Value::String(v.to_string())))
            .collect();
        self.lock()
            .vault
            .log_event(event, if map.is_empty() { None } else { Some(map) });
    }
}
