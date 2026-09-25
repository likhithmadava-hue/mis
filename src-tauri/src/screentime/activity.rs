//! What was actually being done, not just which program was in front.
//!
//! `winapi` can only name a process. For most programs that is the whole
//! answer — `code.exe` is `code.exe`. For a browser it is barely an answer at
//! all: `ulaa.exe` is a past paper, a lecture and an Instagram reel, and
//! totalling them into one neutral bar makes the biggest block of the day the
//! least informative thing on the screen.
//!
//! So every interval resolves to an **activity**, one level below the app:
//!
//! ```text
//!   code.exe   "Integration.rs — main"        →  code.exe       (the app itself)
//!   ulaa.exe   "Limits — Khan Academy"        →  Khan Academy   (a known site)
//!   ulaa.exe   "Bar chart race - Flourish"    →  Flourish       (named in the title)
//!   ulaa.exe   "how do i solve this"          →  Other pages    (unrecognised)
//! ```
//!
//! **Where the site name comes from, stated plainly.** There is still no
//! tab-level API and no URL here — see `winapi.rs`. What there is, is the page
//! title, which Chromium and Firefox both put in the window caption, and which
//! sites overwhelmingly end with their own name. So the browser's own suffix is
//! stripped and the remaining trailing segment is read as the site. That is a
//! *naming* inference, not a *judgement*: a site MIS does not recognise gets
//! its name and nothing else — it starts unfiled at `neutral` and waits to be
//! told, exactly as an unknown `.exe` does. Only names that cannot be argued
//! with carry a shipped category, and one click changes any of them.
//!
//! Nothing here touches what is recorded. Activities are derived when a day is
//! summarised, from the same `(app, title)` pairs already on disk, so every day
//! ever recorded gains the breakdown and no stored file changes shape.

use std::collections::BTreeMap;

/// Keys for browser activities are prefixed so they can never collide with an
/// app name in the settings file, and so `is_web_key` is a string test rather
/// than a lookup.
pub const WEB_PREFIX: &str = "web:";

/// The two browser activities that are not a site.
pub const OTHER_PAGES: &str = "web:*other";
pub const BLANK_PAGE: &str = "web:*blank";

/// Browsers, and the names they append to every window title.
///
/// The executable's own stem is always tried as a label too (`ulaa.exe` →
/// `Ulaa`), which is what most Chromium forks use, so a browser only needs a
/// row here when its title suffix differs from its file name.
pub const BROWSERS: &[(&str, &[&str])] = &[
    ("ulaa.exe", &["Ulaa"]),
    ("msedge.exe", &["Microsoft Edge", "Edge"]),
    ("chrome.exe", &["Google Chrome", "Chrome"]),
    ("chromium.exe", &["Chromium"]),
    ("firefox.exe", &["Mozilla Firefox Private Browsing", "Mozilla Firefox", "Firefox"]),
    ("librewolf.exe", &["LibreWolf"]),
    ("waterfox.exe", &["Waterfox"]),
    ("zen.exe", &["Zen Browser", "Zen"]),
    ("floorp.exe", &["Floorp"]),
    ("brave.exe", &["Brave"]),
    ("opera.exe", &["Opera"]),
    ("opera_gx.exe", &["Opera GX", "Opera"]),
    ("vivaldi.exe", &["Vivaldi"]),
    ("arc.exe", &["Arc"]),
    ("thorium.exe", &["Thorium"]),
    ("iexplore.exe", &["Internet Explorer"]),
];

/// Trailing markers a browser adds that are not part of the page's name.
const PRIVACY_MARKERS: &[&str] =
    &["InPrivate", "Incognito", "Private Browsing", "Private", "Guest"];

/// The punctuation sites put between a page's name and their own.
///
/// Order matters only in that the longer forms are tried first, so `" :: "` is
/// not eaten by `" : "`.
const SEPARATORS: &[&str] =
    &[" :: ", " - ", " — ", " – ", " | ", " • ", " · ", " › ", " / ", " : "];

/// A trailing segment that names a page's *position* rather than its site, and
/// would otherwise become a bucket collecting unrelated pages from everywhere.
const NOT_A_SITE_NAME: &[&str] = &[
    "home", "login", "log in", "sign in", "sign up", "dashboard", "search", "results",
    "untitled", "new tab", "index", "page not found", "error", "loading", "settings",
    "profile", "about", "contact", "menu", "welcome", "checkout", "cart",
];

/// A site MIS recognises by name.
pub struct Site {
    /// Stable across any rename of `label`, because it is what a user's own
    /// category assignment is stored against.
    pub key: &'static str,
    pub label: &'static str,
    pub category: &'static str,
    /// Segment texts that identify it. Matched whole, ignoring case — never as
    /// a substring, or an article *about* YouTube would file itself under it.
    pub marks: &'static [&'static str],
}

const fn site(
    key: &'static str,
    label: &'static str,
    category: &'static str,
    marks: &'static [&'static str],
) -> Site {
    Site { key, label, category, marks }
}

/// The recognised sites.
///
/// The same rule the app defaults follow: **a misfiled site is worse than an
/// unfiled one.** A site only ships as `study` or `distraction` when the answer
/// does not depend on who is looking. Everything genuinely two-sided — YouTube,
/// an AI chat, a search engine, a mail inbox — ships `neutral` and is here for
/// its *name*, so the hours have a label to be judged under and a switch to be
/// filed with.
pub const SITES: &[Site] = &[
    // ── study: reference, courses, and tools you cannot doom-scroll ─────────
    site("khanacademy", "Khan Academy", "study", &["Khan Academy"]),
    site("physicswallah", "Physics Wallah", "study", &["Physics Wallah", "PhysicsWallah", "PW Live"]),
    site("unacademy", "Unacademy", "study", &["Unacademy"]),
    site("vedantu", "Vedantu", "study", &["Vedantu"]),
    site("byjus", "BYJUS", "study", &["BYJUS", "BYJU\u{2019}S", "Byju\u{2019}s"]),
    site("allen", "ALLEN", "study", &["ALLEN", "Allen Digital"]),
    site("aakash", "Aakash", "study", &["Aakash", "AESL"]),
    site("doubtnut", "Doubtnut", "study", &["Doubtnut"]),
    site("toppr", "Toppr", "study", &["Toppr"]),
    site("embibe", "Embibe", "study", &["Embibe"]),
    site("ncert", "NCERT", "study", &["NCERT"]),
    site("nta", "NTA", "study", &["NTA", "National Testing Agency"]),
    site("cambridge", "Cambridge International", "study", &["Cambridge International", "CAIE"]),
    site("savemyexams", "Save My Exams", "study", &["Save My Exams", "SaveMyExams"]),
    site("pmt", "Physics & Maths Tutor", "study", &["Physics & Maths Tutor"]),
    site("brilliant", "Brilliant", "study", &["Brilliant"]),
    site("coursera", "Coursera", "study", &["Coursera"]),
    site("edx", "edX", "study", &["edX"]),
    site("nptel", "NPTEL", "study", &["NPTEL", "SWAYAM"]),
    site("classroom", "Google Classroom", "study", &["Google Classroom", "Classroom"]),
    site("quizlet", "Quizlet", "study", &["Quizlet"]),
    site("anki", "AnkiWeb", "study", &["AnkiWeb"]),
    site("desmos", "Desmos", "study", &["Desmos"]),
    site("geogebra", "GeoGebra", "study", &["GeoGebra"]),
    site("wolfram", "Wolfram|Alpha", "study", &["Wolfram|Alpha", "WolframAlpha", "Wolfram Alpha"]),
    site("symbolab", "Symbolab", "study", &["Symbolab"]),
    site("overleaf", "Overleaf", "study", &["Overleaf"]),
    site("scholar", "Google Scholar", "study", &["Google Scholar"]),
    site("stackoverflow", "Stack Overflow", "study", &["Stack Overflow"]),
    site("stackexchange", "Stack Exchange", "study", &["Stack Exchange", "Mathematics Stack Exchange", "Physics Stack Exchange"]),
    site("github", "GitHub", "study", &["GitHub"]),
    site("mdn", "MDN Web Docs", "study", &["MDN Web Docs", "MDN"]),
    site("gdocs", "Google Docs", "study", &["Google Docs"]),
    site("gsheets", "Google Sheets", "study", &["Google Sheets"]),
    site("gslides", "Google Slides", "study", &["Google Slides"]),
    site("notion", "Notion", "study", &["Notion"]),

    // ── distraction: places whose whole purpose is the next thing ───────────
    site("instagram", "Instagram", "distraction", &["Instagram"]),
    site("facebook", "Facebook", "distraction", &["Facebook"]),
    site("snapchat", "Snapchat", "distraction", &["Snapchat"]),
    site("tiktok", "TikTok", "distraction", &["TikTok"]),
    site("x", "X (Twitter)", "distraction", &["X", "Twitter"]),
    site("reddit", "Reddit", "distraction", &["Reddit"]),
    site("pinterest", "Pinterest", "distraction", &["Pinterest"]),
    site("tumblr", "Tumblr", "distraction", &["Tumblr"]),
    site("ninegag", "9GAG", "distraction", &["9GAG"]),
    site("netflix", "Netflix", "distraction", &["Netflix"]),
    site("primevideo", "Prime Video", "distraction", &["Prime Video"]),
    site("hotstar", "Hotstar", "distraction", &["Hotstar", "JioHotstar", "Disney+ Hotstar"]),
    site("twitch", "Twitch", "distraction", &["Twitch"]),
    site("crunchyroll", "Crunchyroll", "distraction", &["Crunchyroll"]),
    site("discord", "Discord", "distraction", &["Discord"]),
    site("whatsapp", "WhatsApp", "distraction", &["WhatsApp"]),
    site("telegram", "Telegram", "distraction", &["Telegram", "Telegram Web"]),
    site("messenger", "Messenger", "distraction", &["Messenger"]),
    site("steam", "Steam", "distraction", &["Steam", "Steam Community"]),
    site("epic", "Epic Games", "distraction", &["Epic Games", "Epic Games Store"]),
    site("roblox", "Roblox", "distraction", &["Roblox"]),
    site("itchio", "itch.io", "distraction", &["itch.io"]),
    site("poki", "Poki", "distraction", &["Poki"]),
    site("crazygames", "CrazyGames", "distraction", &["CrazyGames"]),
    site("chesscom", "Chess.com", "distraction", &["Chess.com"]),

    // ── neutral, and named on purpose: both sides live here ─────────────────
    site("youtube", "YouTube", "neutral", &["YouTube", "YouTube Music"]),
    site("google", "Google Search", "neutral", &["Google", "Google Search"]),
    site("bing", "Bing", "neutral", &["Bing"]),
    site("duckduckgo", "DuckDuckGo", "neutral", &["DuckDuckGo"]),
    site("gmail", "Gmail", "neutral", &["Gmail"]),
    site("outlook", "Outlook", "neutral", &["Outlook", "Microsoft Outlook"]),
    site("gdrive", "Google Drive", "neutral", &["Google Drive", "My Drive"]),
    site("chatgpt", "ChatGPT", "neutral", &["ChatGPT"]),
    site("claude", "Claude", "neutral", &["Claude"]),
    site("gemini", "Gemini", "neutral", &["Gemini", "Google Gemini"]),
    site("perplexity", "Perplexity", "neutral", &["Perplexity"]),
    site("wikipedia", "Wikipedia", "neutral", &["Wikipedia", "Wikipedia, the free encyclopedia"]),
    site("quora", "Quora", "neutral", &["Quora"]),
    site("medium", "Medium", "neutral", &["Medium"]),
    site("linkedin", "LinkedIn", "neutral", &["LinkedIn"]),
    site("spotify", "Spotify", "neutral", &["Spotify", "Spotify Web Player"]),
    site("soundcloud", "SoundCloud", "neutral", &["SoundCloud"]),
    site("meet", "Google Meet", "neutral", &["Google Meet", "Meet"]),
    site("zoom", "Zoom", "neutral", &["Zoom"]),
    site("teams", "Microsoft Teams", "neutral", &["Microsoft Teams"]),
    site("canva", "Canva", "neutral", &["Canva"]),
    site("translate", "Google Translate", "neutral", &["Google Translate"]),
    site("maps", "Google Maps", "neutral", &["Google Maps"]),
    site("amazon", "Amazon", "neutral", &["Amazon", "Amazon.in", "Amazon.com"]),
    site("flipkart", "Flipkart", "neutral", &["Flipkart"]),
];

/// What one interval was: the app, or the site inside it.
#[derive(Debug, Clone, PartialEq)]
pub struct Activity {
    /// What a category assignment is stored against.
    pub key: String,
    /// What the tab prints.
    pub label: String,
    /// Whether this is a page inside a browser rather than the app itself.
    pub web: bool,
}

pub fn is_browser(app: &str) -> bool {
    browser_labels(app).is_some()
}

pub fn is_web_key(key: &str) -> bool {
    key.starts_with(WEB_PREFIX)
}

/// The shipped category for every recognised site, in the shape
/// `categories::defaults` returns for apps.
pub fn site_defaults() -> BTreeMap<String, String> {
    let mut map: BTreeMap<String, String> = SITES
        .iter()
        .map(|s| (format!("{WEB_PREFIX}{}", s.key), s.category.to_string()))
        .collect();
    // The leftovers are unfiled by definition, and say so rather than guessing.
    map.insert(OTHER_PAGES.into(), "neutral".into());
    map.insert(BLANK_PAGE.into(), "neutral".into());
    map
}

/// Every recognised site's key and the name to print for it, so the tab can
/// label an assignment that has no time against it today.
pub fn site_labels() -> BTreeMap<String, String> {
    let mut map: BTreeMap<String, String> = SITES
        .iter()
        .map(|s| (format!("{WEB_PREFIX}{}", s.key), s.label.to_string()))
        .collect();
    map.insert(OTHER_PAGES.into(), "Other pages".into());
    map.insert(BLANK_PAGE.into(), "New tab".into());
    map
}

fn browser_labels(app: &str) -> Option<&'static [&'static str]> {
    BROWSERS.iter().find(|(name, _)| *name == app).map(|(_, labels)| *labels)
}

fn eq_ci(a: &str, b: &str) -> bool {
    a.chars().count() == b.chars().count()
        && a.chars().zip(b.chars()).all(|(x, y)| x.to_lowercase().eq(y.to_lowercase()))
}

fn ends_with_ci(hay: &str, needle: &str) -> bool {
    let h: Vec<char> = hay.chars().collect();
    let n: Vec<char> = needle.chars().collect();
    n.len() <= h.len()
        && h[h.len() - n.len()..]
            .iter()
            .zip(n.iter())
            .all(|(a, b)| a.to_lowercase().eq(b.to_lowercase()))
}

fn drop_last_chars(s: &str, n: usize) -> String {
    let c: Vec<char> = s.chars().collect();
    c[..c.len().saturating_sub(n)].iter().collect()
}

/// `(23) Inbox — Gmail` → `Inbox — Gmail`
fn strip_badge(title: &str) -> &str {
    let s = title.trim_start();
    let Some(rest) = s.strip_prefix('(') else { return s };
    let Some((count, tail)) = rest.split_once(')') else { return s };
    if !count.is_empty() && count.chars().all(|c| c.is_ascii_digit() || c == '+') {
        return tail.trim_start();
    }
    s
}

/// The page's own name: the window caption with everything the *browser* added
/// taken off. Empty when the caption was nothing but the browser's name, which
/// is what a new tab looks like.
pub fn clean_title(app: &str, title: &str) -> String {
    let Some(labels) = browser_labels(app) else { return title.trim().to_string() };
    let stem = app.strip_suffix(".exe").unwrap_or(app);

    let mut out = strip_badge(title).trim().to_string();
    let mut trimming = true;
    while trimming {
        trimming = false;
        let tails = labels
            .iter()
            .copied()
            .chain(std::iter::once(stem))
            .chain(PRIVACY_MARKERS.iter().copied());

        for tail in tails {
            if eq_ci(&out, tail) {
                return String::new();
            }
            for sep in SEPARATORS {
                let suffix = format!("{sep}{tail}");
                if ends_with_ci(&out, &suffix) {
                    out = drop_last_chars(&out, suffix.chars().count()).trim().to_string();
                    trimming = true;
                    break;
                }
            }
            if trimming {
                break;
            }
        }
    }
    out
}

/// The caption split on the punctuation that separates a page from its site.
fn segments(title: &str) -> Vec<String> {
    let mut work = title.to_string();
    for sep in SEPARATORS {
        work = work.replace(sep, "\u{1}");
    }
    work.split('\u{1}').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect()
}

fn known_site(segs: &[String]) -> Option<&'static Site> {
    let first = segs.first()?;
    let last = segs.last()?;
    SITES.iter().find(|s| {
        s.marks.iter().any(|m| eq_ci(last, m))
            || (segs.len() > 1 && s.marks.iter().any(|m| eq_ci(first, m)))
    })
}

/// Whether a trailing segment reads as the name of a site rather than as part
/// of a page's own title. Deliberately strict: a wrong guess here invents a
/// bucket, and an invented bucket is a lie with a number beside it.
fn looks_like_a_site_name(segment: &str) -> bool {
    let chars = segment.chars().count();
    chars >= 2
        && chars <= 28
        && segment.chars().any(char::is_alphabetic)
        && segment.split_whitespace().count() <= 4
        && !segment.contains("http")
        && !NOT_A_SITE_NAME.iter().any(|n| eq_ci(segment, n))
}

/// What one recorded interval was.
pub fn activity_for(app: &str, title: &str) -> Activity {
    if !is_browser(app) {
        return Activity { key: app.to_string(), label: app.to_string(), web: false };
    }

    let web = |key: String, label: String| Activity { key, label, web: true };

    let cleaned = clean_title(app, title);
    if cleaned.is_empty() {
        return web(BLANK_PAGE.into(), "New tab".into());
    }

    let segs = segments(&cleaned);
    if let Some(s) = known_site(&segs) {
        return web(format!("{WEB_PREFIX}{}", s.key), s.label.to_string());
    }

    // Unrecognised, but the title still names where it came from.
    if segs.len() > 1 {
        let brand = segs.last().expect("segments of a non-empty title");
        if looks_like_a_site_name(brand) {
            return web(format!("{WEB_PREFIX}{}", brand.to_lowercase()), brand.clone());
        }
    }

    web(OTHER_PAGES.into(), "Other pages".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_browser_is_recognised_by_its_process_name() {
        assert!(is_browser("ulaa.exe"));
        assert!(is_browser("msedge.exe"));
        assert!(!is_browser("code.exe"));
    }

    #[test]
    fn a_non_browser_is_its_own_activity() {
        let a = activity_for("code.exe", "main.rs — mis");
        assert_eq!(a.key, "code.exe");
        assert_eq!(a.label, "code.exe");
        assert!(!a.web);
    }

    #[test]
    fn the_browsers_own_name_is_not_part_of_the_page() {
        assert_eq!(clean_title("ulaa.exe", "Limits and continuity - Ulaa"), "Limits and continuity");
        assert_eq!(clean_title("msedge.exe", "Past paper - Microsoft Edge"), "Past paper");
        assert_eq!(clean_title("firefox.exe", "Notes — Mozilla Firefox"), "Notes");
        assert_eq!(clean_title("brave.exe", "Notes - Brave"), "Notes");
    }

    #[test]
    fn an_unread_badge_and_a_private_marker_are_not_part_of_the_page_either() {
        assert_eq!(clean_title("ulaa.exe", "(23) Inbox - Gmail - Ulaa"), "Inbox - Gmail");
        assert_eq!(clean_title("msedge.exe", "Reel - InPrivate - Microsoft Edge"), "Reel");
    }

    #[test]
    fn a_new_tab_is_a_new_tab_and_not_a_page() {
        assert_eq!(clean_title("ulaa.exe", "Ulaa"), "");
        assert_eq!(activity_for("ulaa.exe", "Ulaa").key, BLANK_PAGE);
    }

    #[test]
    fn the_same_browser_splits_into_what_was_done_in_it() {
        let study = activity_for("ulaa.exe", "Integration by parts | Khan Academy - Ulaa");
        let waste = activity_for("ulaa.exe", "reels • Instagram - Ulaa");
        assert_eq!(study.label, "Khan Academy");
        assert_eq!(waste.label, "Instagram");
        assert_ne!(study.key, waste.key, "one browser must not be one bucket");
        assert!(study.web && waste.web);
    }

    #[test]
    fn a_shipped_category_only_exists_where_it_is_not_a_judgement_call() {
        let d = site_defaults();
        assert_eq!(d["web:khanacademy"], "study");
        assert_eq!(d["web:instagram"], "distraction");
        // Both a lecture hall and a time sink. Named, not judged.
        assert_eq!(d["web:youtube"], "neutral");
        assert_eq!(d["web:chatgpt"], "neutral");
        assert_eq!(d[OTHER_PAGES], "neutral");
    }

    #[test]
    fn an_unrecognised_site_keeps_its_name_rather_than_being_guessed_at() {
        let a = activity_for("ulaa.exe", "Bar chart race - Flourish - Ulaa");
        assert_eq!(a.label, "Flourish");
        assert_eq!(a.key, "web:flourish");
        // and it ships with no category at all, so it lands on neutral
        assert!(!site_defaults().contains_key(&a.key));
    }

    #[test]
    fn a_title_that_names_nothing_goes_to_the_leftovers_not_to_a_made_up_site() {
        assert_eq!(activity_for("ulaa.exe", "how do i solve this - Ulaa").key, OTHER_PAGES);
        assert_eq!(activity_for("ulaa.exe", "My page - Home - Ulaa").key, OTHER_PAGES);
        assert_eq!(
            activity_for("ulaa.exe", "Thing - a rather long trailing phrase of prose - Ulaa").key,
            OTHER_PAGES
        );
    }

    #[test]
    fn a_site_named_in_the_middle_of_a_headline_is_not_a_match() {
        // An article about YouTube is not time spent on YouTube.
        let a = activity_for("ulaa.exe", "YouTube changes its rules - BBC News - Ulaa");
        assert_eq!(a.label, "BBC News");
    }

    #[test]
    fn a_site_that_leads_with_its_own_name_is_still_found() {
        let a = activity_for("ulaa.exe", "Amazon.in : running shoes - Ulaa");
        assert_eq!(a.key, "web:amazon");
    }

    #[test]
    fn the_same_site_lands_on_one_key_whichever_browser_it_was_opened_in() {
        let a = activity_for("ulaa.exe", "Lecture 4 - YouTube - Ulaa");
        let b = activity_for("chrome.exe", "Lecture 4 - YouTube - Google Chrome");
        assert_eq!(a.key, b.key);
    }

    #[test]
    fn every_shipped_site_key_is_unique_and_carries_a_real_category() {
        let mut seen = std::collections::BTreeSet::new();
        for s in SITES {
            assert!(seen.insert(s.key), "duplicate site key: {}", s.key);
            assert!(
                super::super::categories::is_valid(s.category),
                "{} ships an unknown category",
                s.key
            );
            assert!(!s.marks.is_empty(), "{} can never be matched", s.key);
        }
    }
}
