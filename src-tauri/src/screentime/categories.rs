//! Sorting apps into study, neutral, and distraction.
//!
//! The defaults below are deliberately short. It is tempting to ship a few
//! hundred guesses, but **a misfiled app is worse than an unfiled one**: it puts
//! a confident wrong number on the screen, and the whole point of MIS is that
//! its numbers can be trusted. So only the unambiguous cases are pre-filled,
//! everything else starts as `neutral`, and reassigning an app is one click.
//!
//! Browsers are the honest hard case and stay `neutral` on purpose. Windows
//! reports `msedge.exe` whether the tab is a past paper or a YouTube binge —
//! there is no tab-level API here (see `winapi.rs`). Calling the browser "study"
//! or "distraction" would be a coin flip dressed up as data. The window titles
//! are recorded and shown under the app, so the split can be judged by eye
//! rather than asserted by the app.

use std::collections::BTreeMap;

use super::store::{Settings, Store};
use super::winapi::{NO_WINDOW_APP, UNKNOWN_APP};

/// Where the day's minutes get totalled. Order matters — it is the order the
/// bars are stacked and the legend is drawn in.
pub const CATEGORIES: [&str; 3] = ["study", "neutral", "distraction"];

pub const DEFAULT_CATEGORY: &str = "neutral";

/// Only the cases that are not a judgement call.
pub fn defaults() -> BTreeMap<String, String> {
    let pairs: &[(&str, &str)] = &[
        // reading and writing work
        ("acrord32.exe", "study"),
        ("sumatrapdf.exe", "study"),
        ("foxitreader.exe", "study"),
        ("winword.exe", "study"),
        ("excel.exe", "study"),
        ("powerpnt.exe", "study"),
        ("onenote.exe", "study"),
        ("obsidian.exe", "study"),
        ("notepad.exe", "study"),
        // making things
        ("code.exe", "study"),
        ("devenv.exe", "study"),
        ("pycharm64.exe", "study"),
        ("idea64.exe", "study"),
        ("python.exe", "study"),
        ("windowsterminal.exe", "study"),
        ("geogebra.exe", "study"),
        // squarely the other way
        ("steam.exe", "distraction"),
        ("steamwebhelper.exe", "distraction"),
        ("epicgameslauncher.exe", "distraction"),
        ("discord.exe", "distraction"),
        ("netflix.exe", "distraction"),
        ("instagram.exe", "distraction"),
        ("whatsapp.exe", "distraction"),
        ("telegram.exe", "distraction"),
        // the desktop and un-nameable processes are time, but not "app time"
        (NO_WINDOW_APP, "neutral"),
        (UNKNOWN_APP, "neutral"),
    ];
    pairs.iter().map(|(a, c)| ((*a).to_string(), (*c).to_string())).collect()
}

pub fn is_valid(category: &str) -> bool {
    CATEGORIES.contains(&category)
}

/// The user's own assignments, filtered to categories that still exist.
pub fn overrides(settings: &Settings) -> BTreeMap<String, String> {
    settings
        .categories
        .iter()
        .filter(|(_, c)| is_valid(c))
        .map(|(a, c)| (a.clone(), c.clone()))
        .collect()
}

/// Defaults with the user's overrides applied on top.
pub fn resolved(settings: &Settings) -> BTreeMap<String, String> {
    let mut map = defaults();
    map.extend(overrides(settings));
    map
}

pub fn category_for(app: &str, resolved: &BTreeMap<String, String>) -> String {
    resolved.get(app).cloned().unwrap_or_else(|| DEFAULT_CATEGORY.to_string())
}

/// Reassign one app. A category outside `CATEGORIES` is refused rather than
/// stored, so a bad value can never reach the totals.
pub fn set_category(store: &Store, app: &str, category: &str) -> crate::error::Result<()> {
    if !is_valid(category) {
        return Err(crate::error::MisError::ScreenTime(format!(
            "unknown category: {category}"
        )));
    }
    let mut settings = store.load_settings();
    settings.categories.insert(app.to_string(), category.to_string());
    store.save_settings(&settings);
    Ok(())
}

/// Drop an override, putting the app back on its default.
pub fn clear_category(store: &Store, app: &str) {
    let mut settings = store.load_settings();
    if settings.categories.remove(app).is_some() {
        store.save_settings(&settings);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browsers_are_left_neutral_on_purpose() {
        let r = resolved(&Settings::default());
        assert_eq!(category_for("msedge.exe", &r), "neutral");
        assert_eq!(category_for("chrome.exe", &r), "neutral");
        assert_eq!(category_for("firefox.exe", &r), "neutral");
    }

    #[test]
    fn an_unknown_app_falls_back_to_neutral_rather_than_guessing() {
        let r = resolved(&Settings::default());
        assert_eq!(category_for("some-random-thing.exe", &r), DEFAULT_CATEGORY);
    }

    #[test]
    fn a_user_override_beats_the_shipped_default() {
        let mut s = Settings::default();
        s.categories.insert("code.exe".into(), "distraction".into());
        assert_eq!(category_for("code.exe", &resolved(&s)), "distraction");
    }

    #[test]
    fn a_nonsense_override_is_ignored_not_totalled() {
        let mut s = Settings::default();
        s.categories.insert("code.exe".into(), "procrastination".into());
        assert_eq!(category_for("code.exe", &resolved(&s)), "study");
    }
}
