//! AES-256-GCM for the vault body, RSA-OAEP for the recovery wrap.
//!
//! Every constant here is pinned to what the Python host wrote, so a vault
//! created by the old app opens in this one unchanged:
//!
//!   - the cipher is AES-256-GCM with a fresh 12-byte nonce per write;
//!   - `AAD` is bound into every ciphertext as additional authenticated data, so
//!     a blob lifted from a different context will not silently decrypt;
//!   - the recovery wrap is RSA-OAEP with SHA-256 for both the digest and MGF1,
//!     matching `cryptography`'s `padding.OAEP(MGF1(SHA256), SHA256, label=None)`.

use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use rsa::{pkcs8::DecodePublicKey, Oaep, RsaPublicKey};
use sha2::{Digest, Sha256};

use super::recovery_key::DEV_PUBLIC_KEY_PEM;
use crate::error::{MisError, Result};

/// Bound into every ciphertext, and used as DPAPI entropy. Changing this string
/// makes every existing vault unopenable.
pub const AAD: &[u8] = b"mis-vault-v1";

pub const KEY_VERSION: u32 = 1;

pub fn b64_encode(bytes: &[u8]) -> String {
    B64.encode(bytes)
}

pub fn b64_decode(s: &str) -> Result<Vec<u8>> {
    B64.decode(s)
        .map_err(|e| MisError::Corrupt(format!("not valid base64: {e}")))
}

/// A fresh 32-byte data key from the OS entropy source.
pub fn new_data_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    key
}

fn cipher(data_key: &[u8]) -> Result<Aes256Gcm> {
    if data_key.len() != 32 {
        return Err(MisError::Corrupt(format!(
            "the data key should be 32 bytes, found {}",
            data_key.len()
        )));
    }
    Aes256Gcm::new_from_slice(data_key)
        .map_err(|e| MisError::Vault(format!("could not set up the cipher: {e}")))
}

/// Encrypt the vault body. Returns `(nonce, ciphertext‖tag)` — the same layout
/// Python's `AESGCM.encrypt` produces, so the two are interchangeable.
pub fn seal(data_key: &[u8], plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let ct = cipher(data_key)?
        .encrypt(Nonce::from_slice(&nonce_bytes), Payload { msg: plaintext, aad: AAD })
        .map_err(|_| MisError::Vault("could not encrypt the vault".into()))?;

    Ok((nonce_bytes.to_vec(), ct))
}

/// Decrypt the vault body.
///
/// A failure here is not just "wrong key" — GCM authenticates the ciphertext,
/// so **any** edit to `vault.mis`, however small, lands in this error. That is
/// what makes the vault tamper-evident rather than merely private.
pub fn open(data_key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>> {
    if nonce.len() != 12 {
        return Err(MisError::Corrupt(format!(
            "the nonce should be 12 bytes, found {}",
            nonce.len()
        )));
    }
    cipher(data_key)?
        .decrypt(Nonce::from_slice(nonce), Payload { msg: ciphertext, aad: AAD })
        .map_err(|_| {
            MisError::Corrupt(
                "the vault failed its integrity check — it was edited outside MIS, or it \
                 belongs to a different key"
                    .into(),
            )
        })
}

/// Wrap the data key with the developer recovery public key.
pub fn wrap_for_recovery(data_key: &[u8]) -> Result<String> {
    let public = RsaPublicKey::from_public_key_pem(DEV_PUBLIC_KEY_PEM)
        .map_err(|e| MisError::Vault(format!("the embedded recovery key is unreadable: {e}")))?;

    let ct = public
        .encrypt(&mut rand::thread_rng(), Oaep::new::<Sha256>(), data_key)
        .map_err(|e| MisError::Vault(format!("could not wrap the key for recovery: {e}")))?;

    Ok(b64_encode(&ct))
}

/// A short identifier for the recovery key in use, so a vault says which key can
/// open it without embedding the key itself. First 16 hex chars of the SHA-256
/// of the PEM — the same derivation the Python host used.
pub fn recovery_key_id() -> String {
    let digest = Sha256::digest(DEV_PUBLIC_KEY_PEM.as_bytes());
    digest.iter().map(|b| format!("{:02x}", b)).collect::<String>()[..16].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sealed_vault_opens_again() {
        let key = new_data_key();
        let (nonce, ct) = seal(&key, b"{\"hello\":\"world\"}").unwrap();
        assert_eq!(open(&key, &nonce, &ct).unwrap(), b"{\"hello\":\"world\"}");
    }

    #[test]
    fn a_single_flipped_bit_is_caught() {
        let key = new_data_key();
        let (nonce, mut ct) = seal(&key, b"today's log").unwrap();
        ct[0] ^= 0x01;
        assert!(open(&key, &nonce, &ct).is_err(), "GCM must reject edited ciphertext");
    }

    #[test]
    fn another_key_cannot_open_it() {
        let (nonce, ct) = seal(&new_data_key(), b"today's log").unwrap();
        assert!(open(&new_data_key(), &nonce, &ct).is_err());
    }

    #[test]
    fn every_write_uses_a_fresh_nonce() {
        // Reusing a nonce under one key is the classic way to break GCM.
        let key = new_data_key();
        let (a, _) = seal(&key, b"x").unwrap();
        let (b, _) = seal(&key, b"x").unwrap();
        assert_ne!(a, b);
    }

    #[test]
    fn the_recovery_wrap_produces_something_and_is_stable_in_identity() {
        assert!(!wrap_for_recovery(&new_data_key()).unwrap().is_empty());
        // The id must not drift — a vault records it to say which key opens it.
        assert_eq!(recovery_key_id().len(), 16);
        assert_eq!(recovery_key_id(), recovery_key_id());
    }
}
