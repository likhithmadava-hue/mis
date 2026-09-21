import { BellRing, Lock, LockOpen, ShieldAlert } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { AppMode, TrackId } from '../../core/db';
import { DAY_TARGET, heat, MODE_META } from '../../core/scoring';
import { confirmDialog, Workspace } from '../../core/ui';
import CheckInCard from './CheckInCard';
import { createChecklist } from './checklist';
import { createDailyLog } from './createDailyLog';
import MasterChecklist from './MasterChecklist';
import PaperForm from './PaperForm';
import TopicsPanel from './TopicsPanel';

/** the readings that are measured rather than ticked — they stay as small cards */
const CHECK_IN: TrackId[] = ['mood', 'well_spent', 'wellness'];

const SCORING_RULES =
  'Each track is scored out of 10, then weighted by the priority you give it — High counts 3×, Medium 2×, Low 1×. Academic and Life score separately, so neither can drag the other down.';

/**
 * The Daily Log tab — the only place in MIS where anything is entered.
 *
 * One master checklist holds everything you tick or count (studies, DPPs,
 * habits, topics to revise and solve, action items); the readings that are
 * measured rather than completed sit beside it as small cards, and logging a
 * mistake opens a drawer instead of lengthening the page. The score, the day's
 * progress and the submit button live together at the top, so what you have done
 * and what it is worth are never a scroll apart.
 */
export default function DailyLog(props: { mode: () => AppMode; onOpen?: (tab: string) => void }) {
  const log = createDailyLog(props.mode);
  const checklist = createChecklist(log, props.mode);
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
    const yes = await confirmDialog({
      title: 'Submit and lock today’s log?',
      body: 'It becomes read-only until you explicitly unlock it, and the unlock is recorded.',
      confirmLabel: 'Submit & lock',
    });
    if (yes) await log.submitLog();
  };

  const progressPct = () => {
    const p = checklist.progress();
    return p.total > 0 ? (p.done / p.total) * 100 : 0;
  };

  const header = (
    <div class="space-y-4">
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
              ? 'bg-destructive/10 border-destructive/40 text-destructive'
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
            <p class="text-xs mt-0.5 leading-relaxed">
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

      <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 flex flex-wrap items-center gap-4 sm:gap-5">
        <div
          class={`w-20 h-20 flex-shrink-0 rounded-2xl border flex flex-col items-center justify-center ${heat(
            (log.dayScore() / DAY_TARGET) * 10,
          )}`}
        >
          <span class="text-3xl font-bold font-mono leading-none">{log.dayScore()}</span>
          <span class="text-[0.625rem] mt-1">of {DAY_TARGET}</span>
        </div>

        <div class="flex-1 min-w-[14rem]">
          <h3 class="text-lg font-bold font-space flex items-center gap-2">
            <Dynamic component={meta().icon} size={18} class="text-primary" /> Today’s{' '}
            {meta().label} Log
          </h3>
          <p class="text-xs text-muted-foreground mt-1 leading-relaxed" title={SCORING_RULES}>
            Scored out of {DAY_TARGET}, weighted by each track’s priority.{' '}
            <span class="text-subtle-foreground">Hover for the rules.</span>
          </p>
          <div class="mt-3 flex items-center gap-3">
            <div
              class="h-1.5 flex-1 overflow-hidden rounded-full bg-background"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={checklist.progress().total}
              aria-valuenow={checklist.progress().done}
              aria-label="Checklist progress today"
            >
              <div
                class="h-full rounded-full bar-primary transition-all"
                style={{ width: `${progressPct()}%` }}
              />
            </div>
            <span class="text-[0.6875rem] font-mono font-bold text-muted-foreground flex-shrink-0">
              {checklist.progress().done} of {checklist.progress().total} done
            </span>
          </div>
        </div>

        {/* The commitment step: submitting freezes today so a slipped day cannot
            be quietly rewritten later. Unlocking stays possible — this is a study
            app, not a court record — but it is always recorded. */}
        <Show when={!log.locked()}>
          <button
            onClick={() => void askAndSubmit()}
            class="flex-shrink-0 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold font-space flex items-center justify-center gap-2 hover:brightness-110 transition"
          >
            <Lock size={14} /> Submit &amp; lock
          </button>
        </Show>
      </div>
    </div>
  );

  return (
    <Workspace header={header}>
      {/* Academic is one column: the checklist, then Topics, then the paper form,
          in the order the page always had. Life keeps a side rail for its
          readings (mood, leisure, wellness), which are cards rather than ticks. */}
      <div
        class={`grid gap-6 items-start ${
          props.mode() === 'academic' ? '' : 'lg:grid-cols-[minmax(0,1fr)_22rem]'
        }`}
      >
        <div class={`space-y-6 min-w-0 ${frozen()}`}>
          <MasterChecklist log={log} checklist={checklist} mode={props.mode()} />

          {/* topics and papers are academic work, so they only appear in that mode.
              Topics is where they are added and organised; the checklist above
              shows the same items to tick off */}
          <Show when={props.mode() === 'academic'}>
            <TopicsPanel
              topics={log.topics()}
              onAdd={(name, kind) => void log.addTopic(name, kind)}
              onToggle={(id) => void log.toggleTopic(id)}
              onDelete={(id) => void log.deleteTopic(id)}
            />
            <PaperForm
              onSubmit={(entry) => void log.addPaper(entry)}
              onOpenDatabase={() => props.onOpen?.('db')}
            />
          </Show>
        </div>

        <Show when={props.mode() === 'life'}>
          <div class={`space-y-4 min-w-0 ${frozen()}`}>
            <For each={log.ordered().filter((id) => CHECK_IN.includes(id))}>
              {(id) => <CheckInCard id={id} log={log} />}
            </For>
          </div>
        </Show>
      </div>
    </Workspace>
  );
}
