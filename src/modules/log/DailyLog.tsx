import { confirm } from '@tauri-apps/plugin-dialog';
import { BellRing, Lock, LockOpen, ShieldAlert, ShieldCheck } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { AppMode } from '../../core/db';
import { DAY_TARGET, heat, MODE_META, TRACK_META } from '../../core/scoring';
import { createDailyLog } from './createDailyLog';
import PaperForm from './PaperForm';
import PriorityPicker from './PriorityPicker';
import TasksPanel from './TasksPanel';
import TopicsPanel from './TopicsPanel';
import TrackControl from './TrackControl';

/**
 * The Daily Log tab — the only place in MIS where anything is entered.
 *
 * One card per track, ordered by the priority you give it, each scored out of
 * 10. Topics and papers are academic work, so they only appear in that mode.
 */
export default function DailyLog(props: { mode: () => AppMode }) {
  const log = createDailyLog(props.mode);
  const meta = () => MODE_META[props.mode()];

  const submittedLabel = () => {
    const at = log.submittedAt();
    return at
      ? new Date(at).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;
  };

  // When locked, the whole entry surface is frozen. Rust refuses the writes
  // regardless — this makes the refusal visible and unclickable rather than
  // letting you fill in a form that will be rejected.
  const frozen = () => (log.locked() ? 'pointer-events-none opacity-60' : '');

  const askAndSubmit = async () => {
    const yes = await confirm(
      'It becomes read-only until you explicitly unlock it, and the unlock is recorded.',
      { title: 'Submit and lock today’s log?', kind: 'warning' },
    );
    if (yes) await log.submitLog();
  };

  return (
    <div class="space-y-6">
      <Show when={log.nudge()}>
        {(msg) => (
          <div class="p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-start gap-2.5 animate-fade-in border-glow">
            <BellRing class="flex-shrink-0 mt-0.5" size={18} />
            <p class="text-xs font-semibold mt-0.5">{msg()}</p>
          </div>
        )}
      </Show>

      <Show when={log.locked()}>
        <div
          class={`p-4 rounded-xl border flex flex-wrap items-start gap-3 animate-fade-in ${
            log.edited()
              ? 'bg-red-500/10 border-red-500/40 text-red-400'
              : 'bg-primary/10 border-primary/30 text-primary'
          }`}
        >
          <Show when={log.edited()} fallback={<Lock class="flex-shrink-0 mt-0.5" size={18} />}>
            <ShieldAlert class="flex-shrink-0 mt-0.5" size={18} />
          </Show>
          {/* min-w gives the Unlock button something to be pushed past, so it
              drops to its own line in a narrow window instead of crushing this */}
          <div class="flex-1 min-w-[12rem]">
            <p class="text-sm font-bold font-space">
              {log.edited()
                ? 'This day was changed after it was submitted'
                : 'Today’s log is submitted'}
            </p>
            <p class="text-xs opacity-80 mt-0.5 leading-relaxed">
              {log.edited()
                ? 'The saved data no longer matches what was locked in. The change is recorded in the tamper-evident audit log.'
                : `Locked${
                    submittedLabel() ? ` at ${submittedLabel()}` : ''
                  } and read-only. Reopen it only to fix a genuine mistake — every unlock is recorded.`}
            </p>
          </div>
          <button
            onClick={() => void log.unlockLog()}
            class="flex-shrink-0 h-8 px-3 rounded-lg bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 hover:border-primary/40 transition-colors"
          >
            <LockOpen size={13} /> Unlock to edit
          </button>
        </div>
      </Show>

      <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-6 flex items-center gap-4 sm:gap-6">
        <div
          class={`w-24 h-24 flex-shrink-0 rounded-2xl border flex flex-col items-center justify-center ${heat(
            (log.dayScore() / DAY_TARGET) * 10,
          )}`}
        >
          <span class="text-3xl font-bold font-mono leading-none">{log.dayScore()}</span>
          <span class="text-[0.625rem] opacity-70 mt-1">of {DAY_TARGET}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-bold font-space flex items-center gap-2">
            <Dynamic component={meta().icon} size={18} class="text-primary" /> Today’s{' '}
            {meta().label} Log
          </h3>
          <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            This is the only place you enter anything. Each track is scored out of 10, then weighted
            by the priority you give it — <span class="text-primary font-semibold">High</span> counts
            3×, Medium 2×, Low 1×. Raising a priority moves that card up and makes it matter more.{' '}
            <span class="text-primary font-semibold">{meta().label}</span> and the other mode score
            separately, so neither can drag the other down.
          </p>
        </div>
      </div>

      <div class={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-start ${frozen()}`}>
        <For each={log.ordered()}>
          {(id) => {
            const isHigh = () => log.priorities()[id] === 'high';
            return (
              <div
                class={`bg-card rounded-2xl border card-shadow p-5 space-y-4 ${
                  isHigh() ? 'border-primary/30' : 'border-border'
                } ${id === 'habits' ? 'lg:col-span-2' : ''}`}
              >
                <div class="flex items-center gap-2.5 border-b border-border pb-3">
                  <Dynamic
                    component={TRACK_META[id].icon}
                    size={16}
                    class={isHigh() ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-bold font-space">{TRACK_META[id].label}</h4>
                    <p class="text-[0.625rem] text-muted-foreground">{TRACK_META[id].hint}</p>
                  </div>
                  <PriorityPicker
                    value={log.priorities()[id]}
                    onChange={(p) => void log.setTrackPriority(id, p)}
                  />
                  <span
                    class={`w-9 h-9 flex-shrink-0 rounded-lg border flex items-center justify-center text-sm font-bold font-mono ${heat(
                      log.scores()[id],
                    )}`}
                  >
                    {Math.round(log.scores()[id])}
                  </span>
                </div>
                <TrackControl id={id} log={log} />
              </div>
            );
          }}
        </For>
      </div>

      {/* the to-do list is the one entry surface both modes share */}
      <div class={frozen()}>
        <TasksPanel
          mode={props.mode()}
          tasks={log.tasks()}
          onAdd={(title, subject, dueDate) => void log.addTask(title, subject, dueDate)}
          onToggle={(id) => void log.toggleTask(id)}
          onDelete={(id) => void log.deleteTask(id)}
        />
      </div>

      {/* topics and papers are academic work, so they only appear in that mode */}
      <Show when={props.mode() === 'academic'}>
        <div class={`space-y-6 ${frozen()}`}>
          <TopicsPanel
            topics={log.topics()}
            onAdd={(name, kind) => void log.addTopic(name, kind)}
            onToggle={(id) => void log.toggleTopic(id)}
            onDelete={(id) => void log.deleteTopic(id)}
          />
          <PaperForm onSubmit={(entry) => void log.addPaper(entry)} />
        </div>
      </Show>

      {/* The commitment step: submitting freezes today so a slipped day cannot
          be quietly rewritten later. Unlocking stays possible — this is a study
          app, not a court record — but it is always recorded. */}
      <Show when={!log.locked()}>
        <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="w-10 h-10 flex-shrink-0 rounded-full bg-accent border border-primary/20 flex items-center justify-center">
            <ShieldCheck size={16} class="text-primary" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold font-space">Done for the day?</p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Submitting locks today’s log and fingerprints it. After that it is read-only — you can
              reopen it to fix a real mistake, but the unlock is recorded.
            </p>
          </div>
          <button
            onClick={() => void askAndSubmit()}
            class="flex-shrink-0 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold font-space flex items-center justify-center gap-2 hover:brightness-110 transition"
          >
            <Lock size={14} /> Submit &amp; lock
          </button>
        </div>
      </Show>
    </div>
  );
}
