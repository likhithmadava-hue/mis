import { Check, Moon, Plus, Trash2 } from 'lucide-solid';
import { createSignal, For, Match, Show, Switch } from 'solid-js';

import type { TrackId } from '../../core/db';
import PriorityPicker from './PriorityPicker';
import type { DailyLogState } from './createDailyLog';

/**
 * The input for one track.
 *
 * Every track scores 0–10 the same way, but each is *entered* differently —
 * hours on a slider, DPPs as two counts, wellness as tap-to-increment buttons.
 * The shape of the control is chosen here so the card around it stays identical
 * for all six, and so adding a track means adding one case rather than a new
 * layout.
 */
export default function TrackControl(props: { id: TrackId; log: DailyLogState }) {
  const log = props.log;
  const today = log.today;
  const user = log.user;

  const [newHabit, setNewHabit] = createSignal('');
  const submitHabit = () => {
    void log.addHabit(newHabit());
    setNewHabit('');
  };

  return (
    <Switch>
      <Match when={props.id === 'studies'}>
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="text-muted-foreground">Hours studied</span>
            <span class="font-mono font-bold text-primary">
              {today().study_hours} / {user().target_study_hours}h
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="12"
            step="0.5"
            value={today().study_hours}
            onInput={(e) => log.patchToday({ study_hours: Number(e.currentTarget.value) })}
            class="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </Match>

      <Match when={props.id === 'dpps'}>
        <div class="flex gap-2">
          <label class="flex-1">
            <span class="text-[0.5625rem] text-muted-foreground block mb-1">Assigned</span>
            <input
              type="number"
              min="0"
              value={today().dpps_got}
              onChange={(e) => log.patchToday({ dpps_got: Number(e.currentTarget.value) })}
              class="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-mono"
            />
          </label>
          <label class="flex-1">
            <span class="text-[0.5625rem] text-muted-foreground block mb-1">Completed</span>
            <input
              type="number"
              min="0"
              value={today().dpps_complete}
              onChange={(e) => log.patchToday({ dpps_complete: Number(e.currentTarget.value) })}
              class="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-mono"
            />
          </label>
        </div>
      </Match>

      <Match when={props.id === 'well_spent'}>
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="text-muted-foreground">Leisure minutes</span>
            <span class="font-mono font-bold text-yellow-500">{today().well_spent_time}m</span>
          </div>
          <input
            type="range"
            min="0"
            max="180"
            step="5"
            value={today().well_spent_time}
            onInput={(e) => log.patchToday({ well_spent_time: Number(e.currentTarget.value) })}
            class="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>
      </Match>

      <Match when={props.id === 'mood'}>
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="text-muted-foreground">Mood score</span>
            <span class="font-mono font-bold text-primary">{today().mood_score}/10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={today().mood_score}
            onInput={(e) => log.patchToday({ mood_score: Number(e.currentTarget.value) })}
            class="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </Match>

      <Match when={props.id === 'wellness'}>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <button
              onClick={() => void log.addWater()}
              class={`p-3 border rounded-xl text-center space-y-1 transition-colors ${
                today().water_count >= user().water_target
                  ? 'bg-success/5 border-success/40'
                  : 'bg-background border-border hover:border-primary/40'
              }`}
            >
              <div class="mx-auto w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                💧
              </div>
              <p class="text-xs font-bold">Hydration</p>
              <p
                class={`text-[0.625rem] font-mono ${
                  today().water_count >= user().water_target
                    ? 'text-success'
                    : 'text-muted-foreground'
                }`}
              >
                {today().water_count}/{user().water_target} cups
              </p>
            </button>
            <button
              onClick={() => void log.addPosture()}
              class="p-3 bg-background border border-border hover:border-emerald-500/40 rounded-xl text-center space-y-1 transition-colors"
            >
              <div class="mx-auto w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                🧘
              </div>
              <p class="text-xs font-bold">Posture</p>
              <p class="text-[0.625rem] text-muted-foreground font-mono">
                {today().posture_count} done
              </p>
            </button>
          </div>

          {/* Sleep is stored on the user, not the day — it is a window you keep,
              not something re-entered every morning. It sits here because
              Wellness is where you are already thinking about it. */}
          <div class="flex gap-2 items-end border-t border-border pt-3">
            <Moon size={14} class="text-muted-foreground mb-2.5 flex-shrink-0" />
            <label class="flex-1">
              <span class="text-[0.5625rem] text-muted-foreground block mb-1">Bedtime</span>
              <input
                type="time"
                value={user().sleep_bedtime}
                onChange={(e) => void log.saveSleep({ sleep_bedtime: e.currentTarget.value })}
                class="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs [color-scheme:dark]"
              />
            </label>
            <label class="flex-1">
              <span class="text-[0.5625rem] text-muted-foreground block mb-1">Wake up</span>
              <input
                type="time"
                value={user().sleep_wake}
                onChange={(e) => void log.saveSleep({ sleep_wake: e.currentTarget.value })}
                class="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs [color-scheme:dark]"
              />
            </label>
          </div>
        </div>
      </Match>

      <Match when={props.id === 'habits'}>
        <div class="space-y-2">
          <For each={log.habits()}>
            {(h) => {
              const done = () => log.doneIds().includes(h.id);
              return (
                <div
                  class={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${
                    done() ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-background border-border'
                  }`}
                >
                  <button
                    onClick={() => void log.toggleHabit(h.id)}
                    class={`w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center ${
                      done()
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Show when={done()}>
                      <Check size={12} stroke-width={3} />
                    </Show>
                  </button>
                  <span
                    class={`flex-1 text-xs truncate ${
                      done() ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {h.name}
                  </span>
                  <PriorityPicker
                    value={h.priority}
                    onChange={(p) => void log.setHabitPriority(h.id, p)}
                  />
                  <button
                    onClick={() => void log.deleteHabit(h.id)}
                    title="Remove habit"
                    class="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            }}
          </For>

          <div class="flex gap-2 pt-1">
            <input
              value={newHabit()}
              onInput={(e) => setNewHabit(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitHabit()}
              placeholder="Add a habit…"
              class="flex-1 h-9 px-3 bg-background border border-border rounded-lg text-xs"
            />
            <button
              onClick={submitHabit}
              class="h-9 px-3 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </Match>
    </Switch>
  );
}
