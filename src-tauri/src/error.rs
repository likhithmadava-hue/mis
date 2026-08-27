//! One error type for the whole backend.
//!
//! Tauri commands must return something that serialises, so `MisError` crosses
//! the bridge as `{ code, message }` — a stable machine-readable tag next to a
//! sentence written for the person reading it.
//!
//! **The two are separate on purpose.** The frontend has to be able to tell a
//! locked-day refusal (an ordinary outcome: the Daily Log says "today is
//! submitted") from a decryption failure (a real fault) — and if the only thing
//! that crossed were the sentence, it would have to do that by matching on
//! English prose. Then rewording a message to be kinder would silently turn a
//! handled case into an error toast. `code` is the contract; `message` is free
//! to change with no consequence beyond what the user reads.

use serde::{ser::SerializeStruct, Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum MisError {
    #[error("vault: {0}")]
    Vault(String),

    #[error("this device cannot open the vault: {0}")]
    Dpapi(String),

    #[error("the vault file is damaged or was written by a newer version of MIS: {0}")]
    Corrupt(String),

    #[error("{0}")]
    NotFound(String),

    /// Every write in the Daily Log passes through the lock guard. This is the
    /// refusal, and it is the truth of the lock — the greyed-out styling in the
    /// UI is only the explanation.
    #[error("today's log is submitted and locked; unlock it to make changes")]
    DayLocked,

    #[error("audit log: {0}")]
    Audit(String),

    #[error("screen time: {0}")]
    ScreenTime(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("{0}")]
    Io(String),
}

impl From<std::io::Error> for MisError {
    fn from(e: std::io::Error) -> Self {
        MisError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for MisError {
    fn from(e: serde_json::Error) -> Self {
        MisError::Corrupt(e.to_string())
    }
}

impl MisError {
    /// The stable tag the frontend may branch on. These strings are part of the
    /// bridge's contract — `src/core/db/api.ts` matches them — so they are
    /// changed with the same care as a field name, and never merely reworded.
    pub fn code(&self) -> &'static str {
        match self {
            MisError::Vault(_) => "vault",
            MisError::Dpapi(_) => "dpapi",
            MisError::Corrupt(_) => "corrupt",
            MisError::NotFound(_) => "not-found",
            MisError::DayLocked => "day-locked",
            MisError::Audit(_) => "audit",
            MisError::ScreenTime(_) => "screen-time",
            MisError::InvalidInput(_) => "invalid-input",
            MisError::Io(_) => "io",
        }
    }
}

impl Serialize for MisError {
    // `std::result::Result` in full: the `Result<T>` alias at the foot of this
    // file shadows the std one for the whole module, and it takes a single
    // parameter — so the two-parameter form a `Serialize` impl must return only
    // compiles when it is spelled out.
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        let mut out = s.serialize_struct("MisError", 2)?;
        out.serialize_field("code", self.code())?;
        out.serialize_field("message", &self.to_string())?;
        out.end()
    }
}

pub type Result<T> = std::result::Result<T, MisError>;
