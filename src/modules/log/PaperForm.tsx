import { useState } from "preact/hooks";
import { ClipboardList, PlusCircle } from "lucide-preact";
import {
  DIFFICULTIES,
  MISTAKE_REASONS,
  type Difficulty,
  type MarkLogbookEntry,
  type MistakeReason,
} from "../../core/db";
import Select from "../../core/ui/Select";
import { DIFFICULTY_BADGE, REASON_BADGE } from "../../core/ui/mistakes";

const GRADES = ["A+", "A", "B", "C", "D", "F"];

interface PaperFormProps {
  onSubmit: (entry: Omit<MarkLogbookEntry, "id" | "date">) => void;
}

/**
 * Logging a paper: what you scored, and — the part that matters — why you
 * dropped the marks. This is what feeds the Error Analysis, Subject
 * Performance and Score History charts on the Growth Tracker.
 */
export default function PaperForm({ onSubmit }: PaperFormProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [grade, setGrade] = useState("A");
  const [score, setScore] = useState(85);
  const [maxScore, setMaxScore] = useState(100);
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [timeSpent, setTimeSpent] = useState(60);
  const [reason, setReason] = useState<MistakeReason>("Careless");
  const [notes, setNotes] = useState("");

  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    onSubmit({
      subject: subject.trim(),
      chapter: chapter.trim(),
      grade,
      score: Number(score),
      max_score: Number(maxScore),
      difficulty,
      time_spent: Number(timeSpent),
      mistake_reason: reason,
      notes: notes.trim(),
    });
    setSubject("");
    setChapter("");
    setNotes("");
    setOpen(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" /> Log a Paper
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Feeds the Error Analysis, Subject Performance and Score History
            charts.
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-space rounded-xl text-xs font-semibold flex items-center gap-1 shadow-md flex-shrink-0"
        >
          <PlusCircle size={14} /> {open ? "Close" : "Log Mistake"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          className="p-4 bg-background border border-primary/20 rounded-2xl space-y-4 animate-fade-in border-glow"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Subject
              </label>
              <input
                type="text"
                placeholder="e.g. Physics"
                required
                value={subject}
                onChange={(e) => setSubject(e.currentTarget.value)}
                className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Chapter
              </label>
              <input
                type="text"
                placeholder="e.g. Kinematics"
                value={chapter}
                onChange={(e) => setChapter(e.currentTarget.value)}
                className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Error Type
              </label>
              <Select
                ariaLabel="Error type"
                value={reason}
                onChange={setReason}
                options={MISTAKE_REASONS.map((r) => ({
                  value: r,
                  label: r,
                  badgeClass: REASON_BADGE[r],
                }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Grade
              </label>
              <Select
                ariaLabel="Grade"
                value={grade}
                onChange={setGrade}
                options={GRADES.map((g) => ({ value: g, label: g }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Difficulty
              </label>
              <Select
                ariaLabel="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTIES.map((d) => ({
                  value: d,
                  label: d,
                  badgeClass: DIFFICULTY_BADGE[d],
                }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Time (min)
              </label>
              <input
                type="number"
                min={0}
                value={timeSpent}
                onChange={(e) => setTimeSpent(Number(e.currentTarget.value))}
                className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">
                  Obtained
                </label>
                <input
                  type="number"
                  required
                  value={score}
                  onChange={(e) => setScore(Number(e.currentTarget.value))}
                  className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">
                  Max
                </label>
                <input
                  type="number"
                  required
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.currentTarget.value))}
                  className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                Notes
              </label>
              <input
                type="text"
                placeholder="What corrected action?"
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
                className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold font-space"
            >
              Insert Entry
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
