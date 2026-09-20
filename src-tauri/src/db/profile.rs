//! What a valid onboarding profile is.
//!
//! The wizard validates as you type, but that is a courtesy, not a guard — the
//! same reasoning as the day lock: the rule lives in Rust, and the screen only
//! explains it. Anything that reaches `auth_setup` is cleaned and checked here,
//! whether it came from the wizard or from someone poking at the bridge.

use std::collections::HashSet;

use super::types::{Profile, UserConfig};
use crate::dates::{now_iso, parse_iso};
use crate::error::{MisError, Result};
use crate::vault::passkey::normalise_username;

const TIMES_OF_DAY: [&str; 4] = ["morning", "afternoon", "evening", "night"];

fn bad(msg: impl Into<String>) -> MisError {
    MisError::Invalid(msg.into())
}

fn within(field: &str, s: &str, max: usize) -> Result<()> {
    if s.chars().count() > max {
        return Err(bad(format!("{field} is too long (most {max} characters)")));
    }
    Ok(())
}

/// `HH:MM`, 24-hour. Empty is allowed only where the caller says so.
fn is_clock(s: &str) -> bool {
    let Some((h, m)) = s.split_once(':') else { return false };
    matches!((h.parse::<u32>(), m.parse::<u32>()), (Ok(h), Ok(m)) if h < 24 && m < 60)
        && h.len() == 2
        && m.len() == 2
}

/// A deliberately loose check: one `@`, something either side, a dot in the
/// domain, no spaces. Real validation is a confirmation email, and this app
/// sends none — so being strict here would only turn away real addresses.
fn looks_like_email(s: &str) -> bool {
    if s.len() > 254 || s.chars().any(char::is_whitespace) {
        return false;
    }
    let mut parts = s.split('@');
    let (Some(local), Some(domain), None) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
}

/// Trim, drop blanks, drop repeats (ignoring case), cap the count.
fn tidy_list(field: &str, items: Vec<String>, max_items: usize, max_len: usize) -> Result<Vec<String>> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for raw in items {
        let s = raw.trim().to_string();
        if s.is_empty() || !seen.insert(s.to_lowercase()) {
            continue;
        }
        within(field, &s, max_len)?;
        out.push(s);
    }
    if out.len() > max_items {
        return Err(bad(format!("Pick at most {max_items} {field}")));
    }
    Ok(out)
}

impl Profile {
    /// The profile as it will be stored: trimmed, normalised, and checked.
    pub fn cleaned(mut self) -> Result<Self> {
        self.username = normalise_username(&self.username);
        let n = self.username.chars().count();
        if !(3..=24).contains(&n)
            || !self
                .username
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '_' | '.' | '-'))
        {
            return Err(bad(
                "Usernames are 3–24 characters: letters, numbers, dots, dashes and underscores",
            ));
        }

        self.email = self.email.trim().to_string();
        if !looks_like_email(&self.email) {
            return Err(bad("That email address doesn't look right"));
        }

        self.full_name = self.full_name.trim().to_string();
        if self.full_name.is_empty() {
            return Err(bad("Tell us your name"));
        }
        within("Your name", &self.full_name, 80)?;

        if !(5..=100).contains(&self.age) {
            return Err(bad("Age should be between 5 and 100"));
        }

        self.grade = self.grade.trim().to_string();
        if self.grade.is_empty() {
            return Err(bad("Choose your class or level"));
        }
        within("Class / level", &self.grade, 40)?;

        self.program = self.program.trim().to_string();
        if self.program.is_empty() {
            return Err(bad("Choose what you are studying for"));
        }
        within("Programme", &self.program, 60)?;

        self.goals = tidy_list("goals", std::mem::take(&mut self.goals), 10, 60)?;
        if self.goals.is_empty() {
            return Err(bad("Pick at least one goal"));
        }

        self.target_exam = self.target_exam.trim().to_string();
        within("Target exam", &self.target_exam, 80)?;
        self.target_score = self.target_score.trim().to_string();
        within("Target score", &self.target_score, 40)?;

        self.exam_date = self.exam_date.trim().to_string();
        if !self.exam_date.is_empty() && parse_iso(&self.exam_date).is_none() {
            return Err(bad("The exam date should be a real calendar date"));
        }

        let mut names = HashSet::new();
        let mut subjects = Vec::new();
        for mut s in std::mem::take(&mut self.subjects) {
            s.name = s.name.trim().to_string();
            if s.name.is_empty() || !names.insert(s.name.to_lowercase()) {
                continue;
            }
            within("A subject name", &s.name, 40)?;
            s.confidence = s.confidence.clamp(1, 5);
            s.last_result = s.last_result.trim().to_string();
            within("A previous result", &s.last_result, 40)?;
            subjects.push(s);
        }
        if subjects.is_empty() {
            return Err(bad("Add at least one subject"));
        }
        if subjects.len() > 15 {
            return Err(bad("That's a lot of subjects — keep it to 15 or fewer"));
        }
        self.subjects = subjects;

        if !self.daily_study_hours.is_finite() || !(0.5..=16.0).contains(&self.daily_study_hours) {
            return Err(bad("Daily study time should be between 0.5 and 16 hours"));
        }
        if !self.focus_span_minutes.is_finite() || !(5.0..=180.0).contains(&self.focus_span_minutes) {
            return Err(bad("Focus span should be between 5 and 180 minutes"));
        }
        if !TIMES_OF_DAY.contains(&self.productive_time.as_str()) {
            return Err(bad("Pick the time of day you work best"));
        }

        // School hours are optional, but only as a pair.
        self.school_start = self.school_start.trim().to_string();
        self.school_end = self.school_end.trim().to_string();
        let (a, b) = (self.school_start.is_empty(), self.school_end.is_empty());
        if a != b
            || (!a && !(is_clock(&self.school_start) && is_clock(&self.school_end)))
        {
            return Err(bad("Give both a start and an end time for school hours, or neither"));
        }

        if !is_clock(&self.sleep_bedtime) || !is_clock(&self.sleep_wake) {
            return Err(bad("Set both your bedtime and your wake-up time"));
        }

        self.preferences = tidy_list("preferences", std::mem::take(&mut self.preferences), 12, 40)?;

        if self.created_at.is_empty() {
            self.created_at = now_iso();
        }
        Ok(self)
    }

    /// Carry the answers MIS already has a home for into the settings it
    /// actually runs on — so onboarding changes behaviour, rather than only
    /// being remembered.
    pub fn apply_to(&self, user: &mut UserConfig) {
        user.name = self.full_name.clone();
        user.target_study_hours = self.daily_study_hours;
        user.sleep_bedtime = self.sleep_bedtime.clone();
        user.sleep_wake = self.sleep_wake.clone();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::types::ProfileSubject;

    fn good() -> Profile {
        Profile {
            username: "  Vohrim ".into(),
            email: "v@example.com".into(),
            full_name: " Vohrim ".into(),
            age: 17,
            grade: "Class 12".into(),
            program: "JEE".into(),
            goals: vec!["Score higher".into(), "score higher".into(), " ".into()],
            target_exam: "JEE Main".into(),
            exam_date: "2027-01-24".into(),
            target_score: "99 percentile".into(),
            subjects: vec![
                ProfileSubject { name: "Physics".into(), confidence: 9, last_result: " 72% ".into() },
                ProfileSubject { name: "physics".into(), confidence: 2, last_result: String::new() },
            ],
            daily_study_hours: 6.0,
            focus_span_minutes: 45.0,
            productive_time: "morning".into(),
            school_start: "08:00".into(),
            school_end: "14:30".into(),
            sleep_bedtime: "23:00".into(),
            sleep_wake: "06:30".into(),
            preferences: vec!["Timed papers".into()],
            created_at: String::new(),
        }
    }

    #[test]
    fn a_good_profile_is_cleaned_not_rejected() {
        let p = good().cleaned().unwrap();
        assert_eq!(p.username, "vohrim");
        assert_eq!(p.full_name, "Vohrim");
        assert_eq!(p.goals, vec!["Score higher"], "duplicates and blanks are dropped");
        assert_eq!(p.subjects.len(), 1, "a repeated subject is dropped");
        assert_eq!(p.subjects[0].confidence, 5, "confidence is clamped to 1–5");
        assert_eq!(p.subjects[0].last_result, "72%");
        assert!(!p.created_at.is_empty());
    }

    #[test]
    fn each_required_answer_is_actually_required() {
        let cases: Vec<(&str, Box<dyn Fn(&mut Profile)>)> = vec![
            ("username", Box::new(|p| p.username = "ab".into())),
            ("bad username chars", Box::new(|p| p.username = "no spaces".into())),
            ("email", Box::new(|p| p.email = "nope".into())),
            ("email domain", Box::new(|p| p.email = "a@b".into())),
            ("name", Box::new(|p| p.full_name = "  ".into())),
            ("age low", Box::new(|p| p.age = 3)),
            ("age high", Box::new(|p| p.age = 130)),
            ("grade", Box::new(|p| p.grade = String::new())),
            ("program", Box::new(|p| p.program = String::new())),
            ("goals", Box::new(|p| p.goals.clear())),
            ("subjects", Box::new(|p| p.subjects.clear())),
            ("hours", Box::new(|p| p.daily_study_hours = 40.0)),
            ("hours nan", Box::new(|p| p.daily_study_hours = f64::NAN)),
            ("span", Box::new(|p| p.focus_span_minutes = 1.0)),
            ("time of day", Box::new(|p| p.productive_time = "whenever".into())),
            ("exam date", Box::new(|p| p.exam_date = "2027-13-40".into())),
            ("lonely school start", Box::new(|p| p.school_end.clear())),
            ("clock", Box::new(|p| p.sleep_bedtime = "25:00".into())),
        ];
        for (what, break_it) in cases {
            let mut p = good();
            break_it(&mut p);
            assert!(p.cleaned().is_err(), "'{what}' should have been refused");
        }
    }

    #[test]
    fn school_hours_and_the_exam_date_are_optional() {
        let mut p = good();
        p.school_start.clear();
        p.school_end.clear();
        p.exam_date.clear();
        assert!(p.cleaned().is_ok());
    }

    #[test]
    fn onboarding_reaches_the_settings_the_app_runs_on() {
        let p = good().cleaned().unwrap();
        let mut user = crate::db::seed::fresh_db().user;
        p.apply_to(&mut user);
        assert_eq!(user.name, "Vohrim");
        assert_eq!(user.target_study_hours, 6.0);
        assert_eq!(user.sleep_bedtime, "23:00");
        assert_eq!(user.sleep_wake, "06:30");
    }
}
