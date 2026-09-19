import { confirm } from '@tauri-apps/plugin-dialog';
import {
  closestCenter,
  DragDropProvider,
  DragDropSensors,
  createSortable,
  SortableProvider,
  transformStyle,
} from '@thisbeyond/solid-dnd';
import {
  BellRing,
  GripVertical,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-solid';
import { For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { AppMode, WidgetPlacement } from '../../core/db';
import { DAY_TARGET, heat, MODE_META, TRACK_META } from '../../core/scoring';
import { editingLayout } from '../../core/ui';
import { createDailyLog, type DailyLogState } from './createDailyLog';
import { cycleSize, moveItem } from './layout';
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
export default function DailyLog(props: { mode: () => AppMode; onOpen?: (tab: string) => void }) {
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

      {/* Cards arrange themselves in priority order by default — this is only
          the user's own override once they have dragged something, via the
          "Edit layout" toggle in the sidebar. Editing swaps the masonry
          columns for a plain grid: solid-dnd measures item positions in
          normal flow, and a multi-column layout would reflow unpredictably
          mid-drag. The polished masonry view returns the moment editing ends. */}
      <Show
        when={editingLayout()}
        fallback={
          <div class={`columns-1 lg:columns-2 gap-6 ${frozen()}`}>
            <For each={log.layout}>
              {(placement) => (
                <TrackCard
                  placement={placement}
                  log={log}
                  spanClass={placement.size === 'lg' ? 'lg:[column-span:all]' : ''}
                  class="mb-6 break-inside-avoid"
                />
              )}
            </For>
          </div>
        }
      >
        <DragDropProvider
          collisionDetector={closestCenter}
          onDragEnd={({ draggable, droppable }) => {
            if (!draggable || !droppable) return;
            const current = log.layout;
            const from = current.findIndex((p) => p.id === draggable.id);
            const to = current.findIndex((p) => p.id === droppable.id);
            if (from === -1 || to === -1 || from === to) return;
            void log.setLayout(moveItem([...current], from, to));
          }}
        >
          <DragDropSensors>
            <SortableProvider ids={log.layout.map((p) => p.id)}>
              <div class={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-start ${frozen()}`}>
                <For each={log.layout}>
                  {(placement) => <SortableTrackCard placement={placement} log={log} />}
                </For>
              </div>
            </SortableProvider>
          </DragDropSensors>
        </DragDropProvider>
      </Show>

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
          <PaperForm
            onSubmit={(entry) => void log.addPaper(entry)}
            onOpenDatabase={() => props.onOpen?.('db')}
          />
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

/**
 * One track's card — the header, priority picker and score badge, then
 * whatever `TrackControl` draws for that track.
 *
 * The drag handle and resize button are optional props rather than an
 * `editing` flag, because the two render paths above want genuinely
 * different things here: outside edit mode there is nothing to attach them
 * to, so they simply do not render.
 */
function TrackCard(props: {
  placement: WidgetPlacement;
  log: DailyLogState;
  spanClass: string;
  class?: string;
  dragHandle?: Record<string, (event: any) => void>;
  onResize?: () => void;
}) {
  const meta = () => TRACK_META[props.placement.id];
  const isHigh = () => props.log.priorities()[props.placement.id] === 'high';

  return (
    <div
      class={`bg-card rounded-2xl border card-shadow p-5 space-y-4 ${props.class ?? ''} ${
        isHigh() ? 'border-primary/30' : 'border-border'
      } ${props.spanClass}`}
    >
      <div class="flex items-center gap-2.5 border-b border-border pb-3">
        <Show when={props.dragHandle}>
          {(activators) => (
            <button
              type="button"
              {...activators()}
              title="Drag to reorder"
              aria-label={`Drag to reorder ${meta().label}`}
              class="flex-shrink-0 -ml-1.5 w-7 h-7 rounded-md grid place-items-center text-subtle-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical size={14} />
            </button>
          )}
        </Show>
        <Dynamic
          component={meta().icon}
          size={16}
          class={isHigh() ? 'text-primary' : 'text-muted-foreground'}
        />
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-bold font-space">{meta().label}</h4>
          <p class="text-[0.625rem] text-muted-foreground">{meta().hint}</p>
        </div>
        <Show when={props.onResize}>
          <button
            type="button"
            onClick={props.onResize}
            title={props.placement.size === 'lg' ? 'Shrink to one column' : 'Widen to a full row'}
            aria-label={
              props.placement.size === 'lg' ? 'Shrink to one column' : 'Widen to a full row'
            }
            class="flex-shrink-0 w-7 h-7 rounded-md grid place-items-center text-subtle-foreground hover:text-foreground hover:bg-muted"
          >
            <Show when={props.placement.size === 'lg'} fallback={<Maximize2 size={13} />}>
              <Minimize2 size={13} />
            </Show>
          </button>
        </Show>
        <PriorityPicker
          value={props.log.priorities()[props.placement.id]}
          onChange={(p) => void props.log.setTrackPriority(props.placement.id, p)}
        />
        <span
          class={`w-9 h-9 flex-shrink-0 rounded-lg border flex items-center justify-center text-sm font-bold font-mono ${heat(
            props.log.scores()[props.placement.id],
          )}`}
        >
          {Math.round(props.log.scores()[props.placement.id])}
        </span>
      </div>
      <TrackControl id={props.placement.id} log={props.log} />
    </div>
  );
}

/** `TrackCard`, made draggable and given its own resize toggle — Edit-layout mode only. */
function SortableTrackCard(props: { placement: WidgetPlacement; log: DailyLogState }) {
  const sortable = createSortable(props.placement.id);

  return (
    <div
      ref={sortable.ref}
      style={transformStyle(sortable.transform)}
      class={`transition-opacity ${sortable.isActiveDraggable ? 'opacity-40' : ''} ${
        props.placement.size === 'lg' ? 'lg:col-span-2' : ''
      }`}
    >
      <TrackCard
        placement={props.placement}
        log={props.log}
        spanClass=""
        dragHandle={sortable.dragActivators}
        onResize={() =>
          void props.log.setLayout(
            props.log.layout.map((p) =>
              p.id === props.placement.id ? { ...p, size: cycleSize(p.size) } : p,
            ),
          )
        }
      />
    </div>
  );
}
