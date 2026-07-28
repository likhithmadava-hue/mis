import { BellRing } from "lucide-preact";
import type { AppMode } from "../../core/db";
import { DAY_TARGET, MODE_META, TRACK_META, heat } from "../../core/scoring";
import PaperForm from "./PaperForm";
import PriorityPicker from "./PriorityPicker";
import TopicsPanel from "./TopicsPanel";
import TrackControl from "./TrackControl";
import { useDailyLog } from "./useDailyLog";

interface DailyLogProps {
  mode: AppMode;
  triggerUpdate: number;
  onLogChange: () => void;
}

/**
 * The Daily Log tab — the only place in MIS where anything is entered.
 *
 * One card per track, ordered by the priority you give it, each scored out of
 * 10. Topics and papers are academic work, so they only appear in that mode.
 */
export default function DailyLog({
  mode,
  triggerUpdate,
  onLogChange,
}: DailyLogProps) {
  const log = useDailyLog(mode, triggerUpdate, onLogChange);
  const { nudge, dayScore, scores, ordered, priorities, topics } = log;

  const meta = MODE_META[mode];

  return (
    <div className="space-y-6">
      {nudge && (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-start gap-2.5 animate-fade-in border-glow">
          <BellRing className="flex-shrink-0 mt-0.5" size={18} />
          <p className="text-xs font-semibold mt-0.5">{nudge}</p>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border card-shadow p-6 flex items-center gap-6">
        <div
          className={`w-24 h-24 flex-shrink-0 rounded-2xl border flex flex-col items-center justify-center ${heat(
            (dayScore / DAY_TARGET) * 10,
          )}`}
        >
          <span className="text-3xl font-bold font-mono leading-none">
            {dayScore}
          </span>
          <span className="text-[10px] opacity-70 mt-1">of {DAY_TARGET}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold font-space flex items-center gap-2">
            <meta.icon size={18} className="text-primary" /> Today’s{" "}
            {meta.label} Log
          </h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            This is the only place you enter anything. Each track is scored out
            of 10, then weighted by the priority you give it —{" "}
            <span className="text-primary font-semibold">High</span> counts 3×,
            Medium 2×, Low 1×. Raising a priority moves that card up and makes
            it matter more.{" "}
            <span className="text-primary font-semibold">{meta.label}</span> and
            the other mode score separately, so neither can drag the other down.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {ordered.map((id) => {
          const { label, icon: Icon, hint } = TRACK_META[id];
          const score = scores[id];
          const isHigh = priorities[id] === "high";
          return (
            <div
              key={id}
              className={`bg-card rounded-2xl border card-shadow p-5 space-y-4 ${
                isHigh ? "border-primary/30" : "border-border"
              } ${id === "habits" ? "lg:col-span-2" : ""}`}
            >
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <Icon
                  size={16}
                  className={isHigh ? "text-primary" : "text-muted-foreground"}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold font-space">{label}</h4>
                  <p className="text-[10px] text-muted-foreground">{hint}</p>
                </div>
                <PriorityPicker
                  value={priorities[id]}
                  onChange={(p) => log.setTrackPriority(id, p)}
                />
                <span
                  className={`w-9 h-9 flex-shrink-0 rounded-lg border flex items-center justify-center text-sm font-bold font-mono ${heat(
                    score,
                  )}`}
                >
                  {Math.round(score)}
                </span>
              </div>
              <TrackControl id={id} log={log} />
            </div>
          );
        })}
      </div>

      {/* topics and papers are academic work, so they only appear in that mode */}
      {mode === "academic" && (
        <>
          <TopicsPanel
            topics={topics}
            onAdd={log.addTopic}
            onToggle={log.toggleTopic}
            onDelete={log.deleteTopic}
          />
          <PaperForm onSubmit={log.addPaper} />
        </>
      )}
    </div>
  );
}
