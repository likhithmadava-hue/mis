//! Sorting apps into study, neutral, and distraction.
//!
//! The defaults below are deliberately short. It is tempting to ship a few
//! hundred guesses, but **a misfiled app is worse than an unfiled one**: it puts
//! a confident wrong number on the screen, and the whole point of MIS is that
//! its numbers can be trusted. So only the unambiguous cases are pre-filled,
//! everything else starts as `neutral`, and reassigning an app is one click.
//!
//! Browsers are the honest hard case, and the *app* row for one stays `neutral`
//! on purpose. Windows reports `ulaa.exe` whether the tab is a past paper or a
//! YouTube binge, so calling the browser itself "study" or "distraction" would
//! be a coin flip dressed up as data.
//!
//! What is categorised instead is the **activity** inside it — the site, read
//! from the page title (see `activity.rs`). That gives a browser's hours a
//! second level with its own assignments, and the four-step order below decides
//! which one wins.

use std::collections::BTreeMap;

use super::activity;
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

// ── Sites ───────────────────────────────────────────────────────────────────

/// The user's own site assignments, filtered to categories that still exist.
pub fn site_overrides(settings: &Settings) -> BTreeMap<String, String> {
    settings
        .sites
        .iter()
        .filter(|(_, c)| is_valid(c))
        .map(|(k, c)| (k.clone(), c.clone()))
        .collect()
}

/// Shipped site categories with the user's own on top.
pub fn resolved_sites(settings: &Settings) -> BTreeMap<String, String> {
    let mut map = activity::site_defaults();
    map.extend(site_overrides(settings));
    map
}

/// Which category one activity counts towards.
///
/// **Specific beats broad, and the user beats the shipped defaults** — in that
/// order of priority:
///
/// ```text
///   1  this site, assigned by the user      "YouTube is study for me"
///   2  this app, assigned by the user       "everything in Ulaa is distraction"
///   3  this site, shipped                   Instagram is distraction
///   4  this app, shipped                    code.exe is study
///   5  neutral                              unfiled
/// ```
///
/// Step 2 sitting above step 3 is the part worth stating: someone who has said
/// their browser is a distraction has said something about *their* browsing,
/// and a shipped default should not quietly overrule them. A site they name
/// themselves (step 1) still carves itself back out.
pub fn category_for_activity(app: &str, key: &str, settings: &Settings) -> String {
    Filing::new(settings).of(app, key)
}

/// The four maps of the order above, built once.
///
/// Summarising a day asks this question for every interval, and rebuilding the
/// shipped tables inside that loop would allocate several maps per row for an
/// answer that cannot change while the loop runs.
pub struct Filing {
    app_over: BTreeMap<String, String>,
    app_def: BTreeMap<String, String>,
    site_over: BTreeMap<String, String>,
    site_def: BTreeMap<String, String>,
}

impl Filing {
    pub fn new(settings: &Settings) -> Self {
        Self {
            app_over: overrides(settings),
            app_def: defaults(),
            site_over: site_overrides(settings),
            site_def: activity::site_defaults(),
        }
    }

    pub fn of(&self, app: &str, key: &str) -> String {
        if !activity::is_web_key(key) {
            return self
                .app_over
                .get(app)
                .or_else(|| self.app_def.get(app))
                .cloned()
                .unwrap_or_else(|| DEFAULT_CATEGORY.to_string());
        }
        self.site_over
            .get(key)
            .or_else(|| self.app_over.get(app))
            .or_else(|| self.site_def.get(key))
            .or_else(|| self.app_def.get(app))
            .cloned()
            .unwrap_or_else(|| DEFAULT_CATEGORY.to_string())
    }
}

/// Assign one site. Refuses a category outside `CATEGORIES`, and refuses a key
/// that is not a site key, so an app can never be filed in the site map where
/// the resolution order would treat it as more specific than it is.
pub fn set_site_category(store: &Store, key: &str, category: &str) -> crate::error::Result<()> {
    if !is_valid(category) {
        return Err(crate::error::MisError::ScreenTime(format!(
            "unknown category: {category}"
        )));
    }
    if !activity::is_web_key(key) {
        return Err(crate::error::MisError::ScreenTime(format!(
            "not a site: {key}"
        )));
    }
    let mut settings = store.load_settings();
    settings.sites.insert(key.to_string(), category.to_string());
    store.save_settings(&settings);
    Ok(())
}

/// Drop a site override, putting it back on its shipped category (or neutral).
pub fn clear_site_category(store: &Store, key: &str) {
    let mut settings = store.load_settings();
    if settings.sites.remove(key).is_some() {
        store.save_settings(&settings);
    }
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
    fn the_browser_itself_is_left_neutral_on_purpose() {
        let r = resolved(&Settings::default());
        assert_eq!(category_for("msedge.exe", &r), "neutral");
        assert_eq!(category_for("chrome.exe", &r), "neutral");
        assert_eq!(category_for("ulaa.exe", &r), "neutral");
    }

    #[test]
    fn one_browser_counts_towards_three_different_categories() {
        let s = Settings::default();
        assert_eq!(category_for_activity("ulaa.exe", "web:khanacademy", &s), "study");
        assert_eq!(category_for_activity("ulaa.exe", "web:youtube", &s), "neutral");
        assert_eq!(category_for_activity("ulaa.exe", "web:instagram", &s), "distraction");
    }

    #[test]
    fn an_unrecognised_site_is_unfiled_rather_than_guessed_at() {
        let s = Settings::default();
        assert_eq!(category_for_activity("ulaa.exe", "web:flourish", &s), DEFAULT_CATEGORY);
        assert_eq!(category_for_activity("ulaa.exe", activity::OTHER_PAGES, &s), DEFAULT_CATEGORY);
    }

    #[test]
    fn naming_a_site_beats_naming_the_browser_it_was_opened_in() {
        let mut s = Settings::default();
        s.categories.insert("ulaa.exe".into(), "distraction".into());
        s.sites.insert("web:khanacademy".into(), "study".into());

        // the broad assignment covers everything it was meant to cover …
        assert_eq!(category_for_activity("ulaa.exe", "web:youtube", &s), "distraction");
        // … except what was named specifically
        assert_eq!(category_for_activity("ulaa.exe", "web:khanacademy", &s), "study");
    }

    #[test]
    fn what_the_user_says_about_a_browser_beats_a_shipped_site_default() {
        let mut s = Settings::default();
        s.categories.insert("ulaa.exe".into(), "study".into());
        // Instagram ships as distraction, but this is their own statement.
        assert_eq!(category_for_activity("ulaa.exe", "web:instagram", &s), "study");
    }

    #[test]
    fn a_nonsense_site_override_is_ignored_not_totalled() {
        let mut s = Settings::default();
        s.sites.insert("web:youtube".into(), "procrastination".into());
        assert_eq!(category_for_activity("ulaa.exe", "web:youtube", &s), "neutral");
    }

    #[test]
    fn an_app_can_never_be_filed_in_the_site_map() {
        let dir = std::env::temp_dir().join("mis-st-test-sitekey");
        let _ = std::fs::remove_dir_all(&dir);
        let store = Store::new(dir.clone());

        assert!(set_site_category(&store, "code.exe", "study").is_err());
        assert!(store.load_settings().sites.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
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
