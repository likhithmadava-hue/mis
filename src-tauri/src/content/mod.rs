//! Study content that ships with the app: the JEE/NEET syllabus and the bank of
//! practice questions.
//!
//! None of this is the student's data. It is read-only, the same on every
//! install, and compiled into the binary (`include_str!`), so there is no file
//! to lose, edit or tamper with, and nothing to decrypt. It comes from Apex via
//! `scripts/extract-apex-data.mjs`, which validates it before writing; the tests
//! below check the same shape again from this side.
//!
//! The ~6.5 MB of JSON is parsed once, on first use, into [`Content`] and kept
//! for the life of the process. The frontend never gets the whole bank at once:
//! chapter summaries for the picker, then one chapter's questions at a time.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

use crate::db::types::Profile;
use crate::error::{MisError, Result};

const SYLLABUS: &str = include_str!("../../data/syllabus.json");
const BANKS: [&str; 4] = [
    include_str!("../../data/bank/physics.json"),
    include_str!("../../data/bank/chemistry.json"),
    include_str!("../../data/bank/mathematics.json"),
    include_str!("../../data/bank/biology.json"),
];

/// One NCERT chapter. `id` (`phy-1-04`) is what MIS stores when it means this
/// chapter; `title` is what it shows and writes into free-text chapter fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyllabusChapter {
    pub id: String,
    pub subject: String,
    /// 1 = first PUC (class 11), 2 = second PUC (class 12)
    pub puc: u8,
    pub num: u32,
    pub title: String,
    /// Apex's exam weight, 1 (low) to 5 (high)
    pub priority: u8,
    /// which entrance exams test it: `"jee"`, `"neet"`
    pub exams: Vec<String>,
    /// the question-bank chapter that covers it, if any. Several NCERT chapters
    /// can share one bank chapter ("Motion in a Straight Line" and "Motion in a
    /// Plane" are both `phy2`).
    pub bank_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Question {
    /// `<bank chapter>-<nnn>`, stable across re-extractions of the same snapshot
    pub id: String,
    pub topic: String,
    /// `Easy` / `Medium` / `Hard` — the same words as `Difficulty`
    pub difficulty: String,
    /// question text; math is KaTeX between `\( \)` and `\[ \]`
    pub text: String,
    pub options: Vec<String>,
    /// index into `options`, as stored — the frontend shuffles the display
    pub correct: u8,
    /// the worked solution, `**bold**` step headings
    pub answer: String,
    pub tip: String,
    /// marks for a right answer
    pub points: f64,
    /// marks taken off for a wrong one (JEE-style negative marking)
    pub negative: f64,
    /// `"original"` (written in the style of the exam) or `"pyq"` (a real past
    /// question). Almost all are `original`; the UI must not call them PYQs.
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Topic {
    pub name: String,
    pub teaser: String,
}

#[derive(Debug, Clone, Deserialize)]
struct BankChapter {
    id: String,
    num: u32,
    title: String,
    teaser: String,
    topics: Vec<Topic>,
    questions: Vec<Question>,
}

#[derive(Debug, Clone, Deserialize)]
struct Bank {
    subject: String,
    chapters: Vec<BankChapter>,
}

/// A bank chapter without its questions — what the chapter picker lists.
#[derive(Debug, Clone, Serialize)]
pub struct BankChapterSummary {
    pub id: String,
    pub subject: String,
    pub num: u32,
    pub title: String,
    pub teaser: String,
    pub topics: Vec<Topic>,
    pub questions: usize,
    /// question count per difficulty, `Easy`/`Medium`/`Hard`
    pub by_difficulty: BTreeMap<String, usize>,
    /// the NCERT chapters this bank chapter covers (may be empty — a few JEE-only
    /// chapters such as practical chemistry are outside the NCERT list)
    pub syllabus_ids: Vec<String>,
}

pub struct Content {
    syllabus: Vec<SyllabusChapter>,
    /// in subject order, then Apex's chapter order
    chapters: Vec<(String, BankChapter)>,
}

static CONTENT: OnceLock<std::result::Result<Content, String>> = OnceLock::new();

fn parse() -> std::result::Result<Content, String> {
    let syllabus: Vec<SyllabusChapter> =
        serde_json::from_str(SYLLABUS).map_err(|e| format!("syllabus.json: {e}"))?;
    let mut chapters = Vec::new();
    for raw in BANKS {
        let bank: Bank = serde_json::from_str(raw).map_err(|e| format!("question bank: {e}"))?;
        for ch in bank.chapters {
            chapters.push((bank.subject.clone(), ch));
        }
    }
    Ok(Content { syllabus, chapters })
}

/// The parsed content. Fails only if the embedded files are malformed, which the
/// tests rule out — but a failure is reported, not a panic in the UI thread.
pub fn content() -> Result<&'static Content> {
    CONTENT
        .get_or_init(parse)
        .as_ref()
        .map_err(|e| MisError::Corrupt(format!("built-in study content: {e}")))
}

/// Which entrance exam(s) the student is preparing for, read from the free text
/// of the profile. Anything that names neither shows everything — hiding a
/// subject from someone because their programme was typed differently would be
/// worse than showing one they don't need.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Track {
    Jee,
    Neet,
    Both,
}

pub fn track_of(profile: Option<&Profile>) -> Track {
    let Some(p) = profile else { return Track::Both };
    let text = format!("{} {}", p.program, p.target_exam).to_lowercase();
    match (text.contains("jee"), text.contains("neet")) {
        (true, false) => Track::Jee,
        (false, true) => Track::Neet,
        _ => Track::Both,
    }
}

impl Track {
    fn allows(self, exams: &[String]) -> bool {
        match self {
            Track::Both => true,
            Track::Jee => exams.iter().any(|e| e == "jee"),
            Track::Neet => exams.iter().any(|e| e == "neet"),
        }
    }

    /// Maths is JEE-only and Biology NEET-only; Physics and Chemistry are both.
    fn allows_subject(self, subject: &str) -> bool {
        match (self, subject) {
            (Track::Jee, "Biology") | (Track::Neet, "Mathematics") => false,
            _ => true,
        }
    }
}

impl Content {
    /// The syllabus chapters on this track, in subject then PUC then chapter order.
    pub fn syllabus(&self, track: Track) -> Vec<SyllabusChapter> {
        self.syllabus.iter().filter(|c| track.allows(&c.exams)).cloned().collect()
    }

    /// Every bank chapter on this track, without questions.
    pub fn bank_chapters(&self, track: Track) -> Vec<BankChapterSummary> {
        self.chapters
            .iter()
            .filter(|(subject, _)| track.allows_subject(subject))
            .map(|(subject, ch)| {
                let mut by_difficulty = BTreeMap::new();
                for q in &ch.questions {
                    *by_difficulty.entry(q.difficulty.clone()).or_insert(0) += 1;
                }
                BankChapterSummary {
                    id: ch.id.clone(),
                    subject: subject.clone(),
                    num: ch.num,
                    title: ch.title.clone(),
                    teaser: ch.teaser.clone(),
                    topics: ch.topics.clone(),
                    questions: ch.questions.len(),
                    by_difficulty,
                    syllabus_ids: self
                        .syllabus
                        .iter()
                        .filter(|s| s.bank_id.as_deref() == Some(ch.id.as_str()))
                        .map(|s| s.id.clone())
                        .collect(),
                }
            })
            .collect()
    }

    /// One bank chapter's questions, in bank order.
    pub fn questions(&self, bank_id: &str) -> Result<Vec<Question>> {
        self.chapters
            .iter()
            .find(|(_, ch)| ch.id == bank_id)
            .map(|(_, ch)| ch.questions.clone())
            .ok_or_else(|| MisError::NotFound(format!("no question-bank chapter {bank_id}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(program: &str, target: &str) -> Profile {
        Profile { program: program.into(), target_exam: target.into(), ..Default::default() }
    }

    #[test]
    fn embedded_content_parses_with_the_expected_counts() {
        let c = content().expect("content parses");
        let questions: usize = c.chapters.iter().map(|(_, ch)| ch.questions.len()).sum();
        assert_eq!(questions, 4300);
        assert_eq!(c.chapters.len(), 86);
        assert_eq!(c.syllabus.len(), 106);
    }

    #[test]
    fn every_bank_link_resolves_and_every_answer_is_in_range() {
        let c = content().unwrap();
        for s in &c.syllabus {
            if let Some(id) = &s.bank_id {
                let (subject, _) = c
                    .chapters
                    .iter()
                    .find(|(_, ch)| &ch.id == id)
                    .unwrap_or_else(|| panic!("{} links to missing {id}", s.id));
                assert_eq!(subject, &s.subject, "{} links across subjects", s.id);
            }
        }
        let mut ids = std::collections::HashSet::new();
        for (_, ch) in &c.chapters {
            for q in &ch.questions {
                assert!(ids.insert(q.id.clone()), "duplicate question id {}", q.id);
                assert!((q.correct as usize) < q.options.len(), "{} answer out of range", q.id);
                assert!(ch.topics.iter().any(|t| t.name == q.topic), "{} topic not listed", q.id);
            }
        }
    }

    #[test]
    fn track_is_read_from_the_profile_text() {
        assert_eq!(track_of(None), Track::Both);
        assert_eq!(track_of(Some(&profile("JEE (Main + Advanced)", ""))), Track::Jee);
        assert_eq!(track_of(Some(&profile("NEET", ""))), Track::Neet);
        assert_eq!(track_of(Some(&profile("JEE + NEET", ""))), Track::Both);
        assert_eq!(track_of(Some(&profile("CBSE / ICSE / State board", "NEET 2027"))), Track::Neet);
        // a programme that names neither shows everything rather than hiding subjects
        assert_eq!(track_of(Some(&profile("Other", ""))), Track::Both);
    }

    #[test]
    fn a_track_hides_the_subject_it_does_not_test() {
        let c = content().unwrap();
        let jee = c.bank_chapters(Track::Jee);
        assert!(jee.iter().all(|ch| ch.subject != "Biology"));
        assert!(jee.iter().any(|ch| ch.subject == "Mathematics"));
        let neet = c.bank_chapters(Track::Neet);
        assert!(neet.iter().all(|ch| ch.subject != "Mathematics"));
        assert!(c.syllabus(Track::Neet).iter().all(|s| s.subject != "Mathematics"));
        assert!(c.syllabus(Track::Jee).iter().all(|s| s.subject != "Biology"));
        assert_eq!(c.bank_chapters(Track::Both).len(), 86);
    }

    #[test]
    fn questions_come_one_chapter_at_a_time() {
        let c = content().unwrap();
        let qs = c.questions("phy2").unwrap();
        assert_eq!(qs.len(), 50);
        assert!(qs.iter().all(|q| q.id.starts_with("phy2-")));
        assert!(matches!(c.questions("nope"), Err(MisError::NotFound(_))));
    }
}
