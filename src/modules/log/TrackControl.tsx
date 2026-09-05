import { useState } from 'react';
import { Check, Moon, Plus, Trash2 } from 'lucide-react';
import type { TrackId } from '../../core/db';
import PriorityPicker from './PriorityPicker';
import type { DailyLogState } from './useDailyLog';

/**
 * The input for one track. Every track scores 0–10 the same way, but each one
 * is entered differently — hours on a slider, DPPs as two counts, wellness as
 * tap-to-increment buttons — so the shape of the control is chosen here.
 */
export default function TrackControl({ id, log }: { id: TrackId; log: DailyLogState }) {
  const { today, user, habits, doneIds, patchToday } = log;
  const [newHabit, setNewHabit] = useState('');

  const submitHabit = () => {
    log.addHabit(newHabit);
    setNewHabit('');
  };

  switch (id) {
    case 'studies':
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Hours studied</span>
            <span className="font-mono font-bold text-primary">
              {today.study_hours} / {user.target_study_hours}h
            </span>
          </div>
          <input
            type="range" min="0" max="12" step="0.5" value={today.study_hours}
            aria-label="Hours studied"
            onChange={(e) => patchToday({ study_hours: Number(e.target.value) })}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      );

    case 'dpps':
      return (
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-[9px] text-muted-foreground block mb-1">Assigned</span>
            <input
              type="number" min="0" value={today.dpps_got}
              onChange={(e) => patchToday({ dpps_got: Number(e.target.value) })}
              className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-mono"
            />
          </label>
          <label className="flex-1">
            <span className="text-[9px] text-muted-foreground block mb-1">Completed</span>
            <input
              type="number" min="0" value={today.dpps_complete}
              onChange={(e) => patchToday({ dpps_complete: Number(e.target.value) })}
              className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-mono"
            />
          </label>
        </div>
      );

    case 'well_spent':
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Leisure minutes</span>
            <span className="font-mono font-bold text-yellow-500">{today.well_spent_time}m</span>
          </div>
          <input
            type="range" min="0" max="180" step="5" value={today.well_spent_time}
            aria-label="Leisure minutes"
            onChange={(e) => patchToday({ well_spent_time: Number(e.target.value) })}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>
      );

    case 'mood':
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Mood score</span>
            <span className="font-mono font-bold text-primary">{today.mood_score}/10</span>
          </div>
          <input
            type="range" min="1" max="10" value={today.mood_score}
            aria-label="Mood score"
            onChange={(e) => patchToday({ mood_score: Number(e.target.value) })}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      );

    case 'wellness':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={log.addWater}
              className={`p-3 border rounded-xl text-center space-y-1 transition-colors ${
                today.water_count >= user.water_target
                  ? 'bg-success/5 border-success/40'
                  : 'bg-background border-border hover:border-primary/40'
              }`}
            >
              <div className="mx-auto w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">💧</div>
              <p className="text-xs font-bold">Hydration</p>
              <p className={`text-[10px] font-mono ${today.water_count >= user.water_target ? 'text-success' : 'text-muted-foreground'}`}>
                {today.water_count}/{user.water_target} cups
              </p>
            </button>
            <button
              onClick={log.addPosture}
              className="p-3 bg-background border border-border hover:border-emerald-500/40 rounded-xl text-center space-y-1 transition-colors"
            >
              <div className="mx-auto w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">🧘</div>
              <p className="text-xs font-bold">Posture</p>
              <p className="text-[10px] text-muted-foreground font-mono">{today.posture_count} done</p>
            </button>
          </div>
          <div className="flex gap-2 items-end border-t border-border pt-3">
            <Moon size={14} className="text-muted-foreground mb-2.5 flex-shrink-0" />
            <label className="flex-1">
              <span className="text-[9px] text-muted-foreground block mb-1">Bedtime</span>
              <input
                type="time" value={user.sleep_bedtime}
                onChange={(e) => log.saveSleep({ sleep_bedtime: e.target.value })}
                className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs [color-scheme:dark]"
              />
            </label>
            <label className="flex-1">
              <span className="text-[9px] text-muted-foreground block mb-1">Wake up</span>
              <input
                type="time" value={user.sleep_wake}
                onChange={(e) => log.saveSleep({ sleep_wake: e.target.value })}
                className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs [color-scheme:dark]"
              />
            </label>
          </div>
        </div>
      );

    case 'habits':
      return (
        <div className="space-y-2">
          {habits.map((h) => {
            const done = doneIds.includes(h.id);
            return (
              <div
                key={h.id}
                className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${
                  done ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-background border-border'
                }`}
              >
                <button
                  onClick={() => log.toggleHabit(h.id)}
                  className={`w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center ${
                    done
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {done && <Check size={12} strokeWidth={3} />}
                </button>
                <span className={`flex-1 text-xs truncate ${done ? 'text-muted-foreground line-through' : ''}`}>
                  {h.name}
                </span>
                <PriorityPicker value={h.priority} onChange={(p) => log.setHabitPriority(h.id, p)} />
                <button
                  onClick={() => log.deleteHabit(h.id)}
                  title="Remove habit"
                  aria-label={`Remove habit ${h.name}`}
                  className="text-muted-foreground/50 hover:text-destructive transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          <div className="flex gap-2 pt-1">
            <input
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitHabit()}
              placeholder="Add a habit…"
              className="flex-1 h-9 px-3 bg-background border border-border rounded-lg text-xs"
            />
            <button
              onClick={submitHabit}
              className="h-9 px-3 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      );

    // every TrackId is handled above; this keeps the component's return type
    // honest for React, which will not accept `undefined`
    default:
      return null;
  }
}
