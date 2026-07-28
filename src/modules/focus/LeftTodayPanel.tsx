import { ClipboardList } from "lucide-preact";
import type { RemainingItem } from "./useTodayProgress";

interface LeftTodayPanelProps {
  remaining: RemainingItem[];
  allClear: boolean;
}

/** what's still outstanding — read-only; the Daily Log owns every number here */
export default function LeftTodayPanel({
  remaining,
  allClear,
}: LeftTodayPanelProps) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
          <ClipboardList size={16} className="text-primary" /> Left Today
        </h3>
        {allClear && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/40">
            All clear
          </span>
        )}
      </div>

      <div className="space-y-3">
        {remaining.map(
          ({ key, label, icon: Icon, left, total, unit, done }) => {
            const cleared = left === 0;
            // nothing assigned is not the same as nothing left — show a dash
            const nothingSet = total === 0;
            const pct = total > 0 ? ((total - left) / total) * 100 : 0;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Icon
                    size={14}
                    className={
                      cleared && !nothingSet
                        ? "text-success"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="text-xs flex-1 min-w-0 truncate">
                    {label}
                  </span>
                  <span
                    className={`text-sm font-bold font-mono flex-shrink-0 ${
                      nothingSet
                        ? "text-muted-foreground/50"
                        : cleared
                          ? "text-success"
                          : "text-foreground"
                    }`}
                  >
                    {nothingSet ? "—" : `${left}${unit}`}
                  </span>
                </div>
                <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cleared ? "bg-success" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {nothingSet ? "nothing set for today" : done}
                </p>
              </div>
            );
          },
        )}
      </div>

      <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
        Read-only — change any of these in the Daily Log.
      </p>
    </div>
  );
}
