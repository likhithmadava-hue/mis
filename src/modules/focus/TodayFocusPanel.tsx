import { Flame } from "lucide-preact";
import type { FocusSession } from "../../core/db";

interface TodayFocusPanelProps {
  sessions: FocusSession[];
  minutes: number;
}

/** what you've already banked today: rounds completed and minutes logged */
export default function TodayFocusPanel({
  sessions,
  minutes,
}: TodayFocusPanelProps) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
        <Flame size={16} className="text-primary" /> Today's Focus
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`p-4 rounded-xl border text-center ${sessions.length > 0 ? "bg-success/5 border-success/40" : "bg-background border-border"}`}
        >
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Sessions
          </p>
          <p
            className={`text-2xl font-bold font-space ${sessions.length > 0 ? "text-success" : ""}`}
          >
            {sessions.length}
          </p>
        </div>
        <div
          className={`p-4 rounded-xl border text-center ${minutes > 0 ? "bg-success/5 border-success/40" : "bg-background border-border"}`}
        >
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Minutes
          </p>
          <p
            className={`text-2xl font-bold font-space ${minutes > 0 ? "text-success" : ""}`}
          >
            {minutes}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No sessions yet today — plant your first tree. 🌱
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2 bg-background border border-border rounded-lg flex items-center justify-between gap-2"
            >
              <span className="text-xs truncate" title={s.tag}>
                {s.tag}
              </span>
              <span className="text-[11px] font-mono text-success font-bold flex-shrink-0">
                {s.duration_minutes}m
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
