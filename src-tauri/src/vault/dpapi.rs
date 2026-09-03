//! Windows DPAPI (Data Protection API).
//!
//! `CryptProtectData` / `CryptUnprotectData` encrypt a blob with a key derived
//! from the *current Windows user's* login secret:
//!
//!   - only this Windows account can decrypt it;
//!   - it is worthless if copied to another PC or read by another user;
//!   - Windows manages the key material — we never see or store it.
//!
//! Used to seal the vault's data key so only the signed-in Windows user can open
//! the vault on this machine.
//!
//! The two functions are declared by hand rather than pulled from the `windows`
//! crate. They are four symbols with stable, thirty-year-old signatures, and
//! declaring them here means a `windows` crate version bump — which does churn
//! its higher-level wrappers — can never quietly change how the vault key is
//! sealed. The screen-time tracker, which needs a genuinely large slice of the
//! Win32 surface, does use the crate.

use crate::error::{MisError, Result};

#[cfg(windows)]
mod sys {
    use std::ffi::c_void;

    #[repr(C)]
    pub struct DataBlob {
        pub cb_data: u32,
        pub pb_data: *mut u8,
    }

    impl DataBlob {
        pub fn from_slice(data: &[u8]) -> Self {
            Self {
                cb_data: data.len() as u32,
                // The API only reads from this buffer; the cast away from const
                // is required by the C signature, not by us mutating it.
                pb_data: data.as_ptr() as *mut u8,
            }
        }

        pub fn empty() -> Self {
            Self { cb_data: 0, pb_data: std::ptr::null_mut() }
        }

        /// Copy the bytes Windows allocated into a Vec we own.
        ///
        /// # Safety
        /// Only valid on a blob Windows filled in and has not yet freed.
        pub unsafe fn to_vec(&self) -> Vec<u8> {
            if self.pb_data.is_null() {
                return Vec::new();
            }
            std::slice::from_raw_parts(self.pb_data, self.cb_data as usize).to_vec()
        }
    }

    /// Do not pop a Windows UI prompt if the key is unavailable — just fail.
    pub const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

    #[link(name = "crypt32")]
    extern "system" {
        pub fn CryptProtectData(
            data_in: *const DataBlob,
            data_descr: *const u16,
            optional_entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt_struct: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;

        pub fn CryptUnprotectData(
            data_in: *const DataBlob,
            data_descr: *mut *mut u16,
            optional_entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt_struct: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn LocalFree(mem: *mut c_void) -> *mut c_void;
        pub fn GetLastError() -> u32;
    }
}

/// Encrypt to a form only this Windows user, on this machine, can decrypt.
#[cfg(windows)]
pub fn protect(data: &[u8], entropy: &[u8]) -> Result<Vec<u8>> {
    unsafe {
        let blob_in = sys::DataBlob::from_slice(data);
        let ent = sys::DataBlob::from_slice(entropy);
        let mut blob_out = sys::DataBlob::empty();

        let ok = sys::CryptProtectData(
            &blob_in,
            std::ptr::null(),
            if entropy.is_empty() { std::ptr::null() } else { &ent },
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            sys::CRYPTPROTECT_UI_FORBIDDEN,
            &mut blob_out,
        );

        if ok == 0 {
            return Err(MisError::Dpapi(format!(
                "Windows refused to seal the vault key (error {})",
                sys::GetLastError()
            )));
        }

        let out = blob_out.to_vec();
        sys::LocalFree(blob_out.pb_data as *mut _);
        Ok(out)
    }
}

/// Reverse of `protect`. Fails if run as a different Windows user or on a
/// different PC — which is exactly the guarantee we want.
#[cfg(windows)]
pub fn unprotect(data: &[u8], entropy: &[u8]) -> Result<Vec<u8>> {
    unsafe {
        let blob_in = sys::DataBlob::from_slice(data);
        let ent = sys::DataBlob::from_slice(entropy);
        let mut blob_out = sys::DataBlob::empty();

        let ok = sys::CryptUnprotectData(
            &blob_in,
            std::ptr::null_mut(),
            if entropy.is_empty() { std::ptr::null() } else { &ent },
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            sys::CRYPTPROTECT_UI_FORBIDDEN,
            &mut blob_out,
        );

        if ok == 0 {
            return Err(MisError::Dpapi(format!(
                "this vault was sealed by a different Windows account or on a different \
                 computer, so it cannot be opened here (error {})",
                sys::GetLastError()
            )));
        }

        let out = blob_out.to_vec();
        sys::LocalFree(blob_out.pb_data as *mut _);
        Ok(out)
    }
}

// ── Non-Windows ─────────────────────────────────────────────────────────────
// MIS ships for Windows only. These exist so `cargo test` and `cargo check`
// still run on another platform; they refuse loudly rather than pretending to
// seal anything, because a silent no-op here would write an unencrypted key.

#[cfg(not(windows))]
pub fn protect(_data: &[u8], _entropy: &[u8]) -> Result<Vec<u8>> {
    Err(MisError::Dpapi("DPAPI is only available on Windows".into()))
}

#[cfg(not(windows))]
pub fn unprotect(_data: &[u8], _entropy: &[u8]) -> Result<Vec<u8>> {
    Err(MisError::Dpapi("DPAPI is only available on Windows".into()))
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn a_sealed_blob_round_trips_for_this_user() {
        let secret = b"a 32-byte data key would go here";
        let sealed = protect(secret, b"mis-vault-v1").expect("seal");
        assert_ne!(sealed, secret.to_vec(), "the sealed form must not be the plaintext");
        assert_eq!(unprotect(&sealed, b"mis-vault-v1").expect("open"), secret);
    }

    #[test]
    fn the_wrong_entropy_cannot_open_it() {
        let sealed = protect(b"secret", b"mis-vault-v1").expect("seal");
        assert!(unprotect(&sealed, b"something-else").is_err());
    }
}
