//! Starting MIS at Windows login, so background tracking needs no open window.
//!
//! One value under the *current user's* `Run` key — no service, no scheduled
//! task, nothing that needs administrator rights, and nothing outside the
//! logged-in account. Removing the value is the whole of switching it off.
//!
//! Three registry calls, declared by hand like every other Win32 call in MIS
//! (see `winapi.rs` for why there is no `windows` crate).

/// The flag the login entry passes. A process started with it opens no window.
pub const BACKGROUND_FLAG: &str = "--background";

/// Debug builds register under a different name, so a `tauri dev` session can
/// never overwrite (or remove) the entry of an installed copy.
const VALUE_NAME: &str = if cfg!(debug_assertions) { "MIS (Dev)" } else { "MIS" };

/// Register (`true`) or remove (`false`) the login entry for this executable.
pub fn set(enabled: bool) -> Result<(), String> {
    imp::set(enabled)
}

#[cfg(windows)]
mod imp {
    use super::{BACKGROUND_FLAG, VALUE_NAME};
    use std::ffi::c_void;

    type Hkey = isize;

    /// `(HKEY)(LONG)0x80000001`, sign-extended exactly as the header defines it.
    const HKEY_CURRENT_USER: Hkey = 0x8000_0001u32 as i32 as isize;
    const KEY_SET_VALUE: u32 = 0x0002;
    const REG_SZ: u32 = 1;
    const ERROR_FILE_NOT_FOUND: i32 = 2;

    #[link(name = "advapi32")]
    extern "system" {
        fn RegCreateKeyExW(
            key: Hkey,
            sub_key: *const u16,
            reserved: u32,
            class: *const u16,
            options: u32,
            desired: u32,
            security: *const c_void,
            result: *mut Hkey,
            disposition: *mut u32,
        ) -> i32;
        fn RegSetValueExW(
            key: Hkey,
            name: *const u16,
            reserved: u32,
            kind: u32,
            data: *const u8,
            len: u32,
        ) -> i32;
        fn RegDeleteValueW(key: Hkey, name: *const u16) -> i32;
        fn RegCloseKey(key: Hkey) -> i32;
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn set(enabled: bool) -> Result<(), String> {
        let sub_key = wide(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let name = wide(VALUE_NAME);

        unsafe {
            let mut key: Hkey = 0;
            let rc = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                sub_key.as_ptr(),
                0,
                std::ptr::null(),
                0,
                KEY_SET_VALUE,
                std::ptr::null(),
                &mut key,
                std::ptr::null_mut(),
            );
            if rc != 0 {
                return Err(format!("could not open the Windows startup list (error {rc})"));
            }

            let rc = if enabled {
                let exe = std::env::current_exe().map_err(|e| e.to_string())?;
                let command = wide(&format!("\"{}\" {BACKGROUND_FLAG}", exe.display()));
                RegSetValueExW(
                    key,
                    name.as_ptr(),
                    0,
                    REG_SZ,
                    command.as_ptr().cast(),
                    (command.len() * 2) as u32,
                )
            } else {
                match RegDeleteValueW(key, name.as_ptr()) {
                    // Already absent is the state we wanted.
                    ERROR_FILE_NOT_FOUND => 0,
                    other => other,
                }
            };
            RegCloseKey(key);

            if rc != 0 {
                return Err(format!("could not update the Windows startup list (error {rc})"));
            }
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn set(_enabled: bool) -> Result<(), String> {
        Err("Starting at login is only supported on Windows.".into())
    }
}
