//! The two secrets a person can hold — a password and a recovery code — turned
//! into keys that wrap the vault's data key.
//!
//! ```text
//!   password ──Argon2id(salt)──► key ──AES-GCM──► [data key]   "pass"     wrap
//!   recovery code ──SHA-256(salt)──► key ──AES-GCM──► [data key]  "recovery" wrap
//! ```
//!
//! **Nothing here stores a password hash, and nothing compares one.** A wrong
//! password derives a wrong key and AES-GCM refuses to open the wrap; that
//! refusal *is* the check. It is the same idea the vault already leans on — a
//! tampered vault fails to decrypt rather than being compared against a
//! checksum — and it means there is no separate "hash" for an attacker to attack
//! in isolation: the only thing to guess against is the real key.
//!
//! The username is bound in as AAD. That is what makes the login form's second
//! field mean something (a wrong username fails exactly like a wrong password)
//! without writing the username to `vault.key` in the clear. It is a
//! discriminator, not a secret; the security is the password.
//!
//! The recovery code is 25 random characters (125 bits), so a fast hash is
//! enough to stretch it — Argon2 exists to slow the guessing of human-chosen
//! secrets, and this one is not human-chosen.

use argon2::{Algorithm, Argon2, Params, Version};
use rand::{Rng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use super::crypto;
use crate::error::{MisError, Result};

pub const MIN_PASSWORD_LEN: usize = 8;
pub const MAX_PASSWORD_LEN: usize = 128;

const PASS_AAD_PREFIX: &[u8] = b"mis-pass-v1|";
const RECOVERY_AAD: &[u8] = b"mis-recovery-v1";

/// No I or O — they read as 1 and 0 when a code is copied off a screen or a
/// sheet of paper.
const CODE_ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN: usize = 25;

/// Argon2id cost. Stored beside every wrap so it can be raised later without
/// orphaning vaults written with the old numbers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct KdfParams {
    pub m: u32, // memory, KiB
    pub t: u32, // passes
    pub p: u32, // lanes
}

impl KdfParams {
    /// 64 MiB, 3 passes: a few tenths of a second on this machine's 2-core i3 —
    /// long enough to make offline guessing expensive, short enough that nobody
    /// notices it at the login screen.
    pub const fn interactive() -> Self {
        Self { m: 64 * 1024, t: 3, p: 1 }
    }

    #[cfg(test)]
    pub const fn cheap() -> Self {
        Self { m: 64, t: 1, p: 1 }
    }

    /// Reject numbers a hand-edited `vault.key` could use to make opening the
    /// app allocate gigabytes or spin forever.
    fn checked(self) -> Result<Self> {
        let sane = (8..=1 << 20).contains(&self.m)
            && (1..=10).contains(&self.t)
            && (1..=4).contains(&self.p);
        sane.then_some(self)
            .ok_or_else(|| MisError::Corrupt("vault.key has unreasonable KDF settings".into()))
    }
}

/// `vault.key → wrap.pass`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassWrap {
    pub kdf: String,
    #[serde(flatten)]
    pub params: KdfParams,
    pub salt: String,
    pub nonce: String,
    pub ct: String,
}

/// `vault.key → wrap.recovery`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryWrap {
    pub salt: String,
    pub nonce: String,
    pub ct: String,
}

// ── Passwords ───────────────────────────────────────────────────────────────

/// The form a username is compared in: trimmed and lower-cased, so `Vohrim ` and
/// `vohrim` are the same person.
pub fn normalise_username(raw: &str) -> String {
    raw.trim().to_lowercase()
}

pub fn check_password(password: &str) -> Result<()> {
    let n = password.chars().count();
    if n < MIN_PASSWORD_LEN {
        return Err(MisError::Invalid(format!(
            "Use at least {MIN_PASSWORD_LEN} characters for the password"
        )));
    }
    if n > MAX_PASSWORD_LEN {
        return Err(MisError::Invalid(format!(
            "Keep the password to {MAX_PASSWORD_LEN} characters or fewer"
        )));
    }
    Ok(())
}

fn derive(password: &str, salt: &[u8], params: KdfParams) -> Result<Zeroizing<[u8; 32]>> {
    let p = params.checked()?;
    let argon = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(p.m, p.t, p.p, Some(32))
            .map_err(|e| MisError::Vault(format!("bad KDF parameters: {e}")))?,
    );
    let mut out = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(password.as_bytes(), salt, out.as_mut())
        .map_err(|e| MisError::Vault(format!("could not stretch the password: {e}")))?;
    Ok(out)
}

fn pass_aad(username: &str) -> Vec<u8> {
    let mut aad = PASS_AAD_PREFIX.to_vec();
    aad.extend_from_slice(normalise_username(username).as_bytes());
    aad
}

pub fn wrap_with_password(
    data_key: &[u8],
    username: &str,
    password: &str,
    params: KdfParams,
) -> Result<PassWrap> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let key = derive(password, &salt, params)?;
    let (nonce, ct) = crypto::seal_aad(key.as_ref(), data_key, &pass_aad(username))?;
    Ok(PassWrap {
        kdf: "argon2id".into(),
        params,
        salt: crypto::b64_encode(&salt),
        nonce: crypto::b64_encode(&nonce),
        ct: crypto::b64_encode(&ct),
    })
}

/// The data key, if — and only if — the username and password are the pair the
/// wrap was made with.
pub fn unwrap_with_password(
    wrap: &PassWrap,
    username: &str,
    password: &str,
) -> Result<Zeroizing<Vec<u8>>> {
    if wrap.kdf != "argon2id" {
        return Err(MisError::Corrupt(format!("unknown password scheme '{}'", wrap.kdf)));
    }
    let salt = crypto::b64_decode(&wrap.salt)?;
    let key = derive(password, &salt, wrap.params)?;
    crypto::open_aad(
        key.as_ref(),
        &crypto::b64_decode(&wrap.nonce)?,
        &crypto::b64_decode(&wrap.ct)?,
        &pass_aad(username),
    )
    .map(Zeroizing::new)
    .ok_or(MisError::BadCredentials)
}

// ── Recovery codes ──────────────────────────────────────────────────────────

/// A fresh code, grouped `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` for reading aloud or
/// copying by hand.
pub fn new_recovery_code() -> String {
    let mut rng = rand::thread_rng();
    let mut out = String::with_capacity(CODE_LEN + 4);
    for i in 0..CODE_LEN {
        if i > 0 && i % 5 == 0 {
            out.push('-');
        }
        out.push(CODE_ALPHABET[rng.gen_range(0..CODE_ALPHABET.len())] as char);
    }
    out
}

/// What was typed, reduced to the bare characters: case, dashes and spaces are
/// all forgiven, because a code copied off paper arrives with any of them.
fn normalise_code(raw: &str) -> Result<String> {
    let s: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect();
    let ok = s.len() == CODE_LEN && s.bytes().all(|b| CODE_ALPHABET.contains(&b));
    ok.then_some(s).ok_or(MisError::BadRecoveryCode)
}

fn code_key(normalised: &str, salt: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(RECOVERY_AAD);
    h.update(salt);
    h.update(normalised.as_bytes());
    h.finalize().into()
}

pub fn wrap_with_code(data_key: &[u8], code: &str) -> Result<RecoveryWrap> {
    let code = normalise_code(code)?;
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let key = Zeroizing::new(code_key(&code, &salt));
    let (nonce, ct) = crypto::seal_aad(key.as_ref(), data_key, RECOVERY_AAD)?;
    Ok(RecoveryWrap {
        salt: crypto::b64_encode(&salt),
        nonce: crypto::b64_encode(&nonce),
        ct: crypto::b64_encode(&ct),
    })
}

pub fn unwrap_with_code(wrap: &RecoveryWrap, code: &str) -> Result<Zeroizing<Vec<u8>>> {
    let code = normalise_code(code)?;
    let salt = crypto::b64_decode(&wrap.salt)?;
    let key = Zeroizing::new(code_key(&code, &salt));
    crypto::open_aad(
        key.as_ref(),
        &crypto::b64_decode(&wrap.nonce)?,
        &crypto::b64_decode(&wrap.ct)?,
        RECOVERY_AAD,
    )
    .map(Zeroizing::new)
    .ok_or(MisError::BadRecoveryCode)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key() -> [u8; 32] {
        crypto::new_data_key()
    }

    #[test]
    fn the_right_username_and_password_open_the_wrap() {
        let dk = key();
        let w = wrap_with_password(&dk, "vohrim", "correct horse", KdfParams::cheap()).unwrap();
        let got = unwrap_with_password(&w, "vohrim", "correct horse").unwrap();
        assert_eq!(got.as_slice(), &dk);
    }

    #[test]
    fn a_wrong_password_is_refused() {
        let w = wrap_with_password(&key(), "vohrim", "correct horse", KdfParams::cheap()).unwrap();
        assert!(matches!(
            unwrap_with_password(&w, "vohrim", "battery staple"),
            Err(MisError::BadCredentials)
        ));
    }

    #[test]
    fn a_wrong_username_fails_the_same_way_as_a_wrong_password() {
        let w = wrap_with_password(&key(), "vohrim", "correct horse", KdfParams::cheap()).unwrap();
        assert!(matches!(
            unwrap_with_password(&w, "someone-else", "correct horse"),
            Err(MisError::BadCredentials)
        ));
    }

    #[test]
    fn usernames_ignore_case_and_surrounding_space() {
        let dk = key();
        let w = wrap_with_password(&dk, "  Vohrim ", "correct horse", KdfParams::cheap()).unwrap();
        assert!(unwrap_with_password(&w, "vohrim", "correct horse").is_ok());
    }

    #[test]
    fn two_wraps_of_one_key_share_no_bytes_worth_matching() {
        // Fresh salt and nonce every time: identical inputs must not produce
        // identical files.
        let dk = key();
        let a = wrap_with_password(&dk, "u", "password1", KdfParams::cheap()).unwrap();
        let b = wrap_with_password(&dk, "u", "password1", KdfParams::cheap()).unwrap();
        assert_ne!(a.salt, b.salt);
        assert_ne!(a.ct, b.ct);
    }

    #[test]
    fn a_hand_edited_kdf_cost_is_rejected_rather_than_obeyed() {
        let mut w = wrap_with_password(&key(), "u", "password1", KdfParams::cheap()).unwrap();
        w.params.m = u32::MAX;
        assert!(matches!(unwrap_with_password(&w, "u", "password1"), Err(MisError::Corrupt(_))));
    }

    #[test]
    fn the_password_length_rules() {
        assert!(check_password("short").is_err());
        assert!(check_password("long enough").is_ok());
        assert!(check_password(&"x".repeat(MAX_PASSWORD_LEN + 1)).is_err());
    }

    #[test]
    fn a_recovery_code_is_grouped_and_from_the_safe_alphabet() {
        let c = new_recovery_code();
        assert_eq!(c.len(), CODE_LEN + 4);
        assert_eq!(c.matches('-').count(), 4);
        assert!(c.replace('-', "").bytes().all(|b| CODE_ALPHABET.contains(&b)));
        assert_ne!(new_recovery_code(), new_recovery_code());
    }

    #[test]
    fn a_recovery_code_opens_its_wrap_however_it_was_typed() {
        let dk = key();
        let code = new_recovery_code();
        let w = wrap_with_code(&dk, &code).unwrap();

        assert_eq!(unwrap_with_code(&w, &code).unwrap().as_slice(), &dk);
        let sloppy = format!("  {}  ", code.to_lowercase().replace('-', " "));
        assert_eq!(unwrap_with_code(&w, &sloppy).unwrap().as_slice(), &dk);
    }

    #[test]
    fn the_wrong_recovery_code_is_refused() {
        let w = wrap_with_code(&key(), &new_recovery_code()).unwrap();
        assert!(matches!(
            unwrap_with_code(&w, &new_recovery_code()),
            Err(MisError::BadRecoveryCode)
        ));
        assert!(matches!(unwrap_with_code(&w, "too-short"), Err(MisError::BadRecoveryCode)));
    }

    #[test]
    fn a_password_wrap_cannot_be_replayed_as_a_recovery_wrap() {
        // Different AAD: lifting `pass` into the `recovery` slot must not work
        // even for someone who knows both secrets' derivation.
        let dk = key();
        let code = new_recovery_code();
        let w = wrap_with_code(&dk, &code).unwrap();
        let salt = crypto::b64_decode(&w.salt).unwrap();
        let k = code_key(&normalise_code(&code).unwrap(), &salt);
        let opened = crypto::open_aad(
            &k,
            &crypto::b64_decode(&w.nonce).unwrap(),
            &crypto::b64_decode(&w.ct).unwrap(),
            &pass_aad("anyone"),
        );
        assert!(opened.is_none());
    }
}
