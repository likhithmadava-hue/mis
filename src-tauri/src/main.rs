// Windows: no console window behind the app in a release build. The attribute is
// left off in debug so `println!` and panics stay visible while developing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mis_lib::run()
}
