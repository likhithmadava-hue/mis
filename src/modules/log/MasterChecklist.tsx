import {
  BookOpen,
  ListChecks,
  ListTodo,
  Minus,
  PenLine,
  Plus,
  PlusCircle,
  RefreshCw,
  Repeat,
} from 'lucide-solid';
import type { JSX } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';

import { shortDate, todayIso } from '../../core/dates';
import type { AppMode, DppItem, Task, TopicItem, TrackId } from '../../core/db';
import { Combobox } from '../../core/ui';
import ChecklistSection, { CheckRow } from './ChecklistSection';
import type { Checklist } from './checklist';
import type { DailyLogState } from './createDailyLog';
import { isReferenceKind } from './kindOptions';
import PriorityPicker from './PriorityPicker';

interface MasterChecklistProps {
  log: DailyLogState;
  checklist: Checklist;
  mode: AppMode;
}

/**
 * Everything you tick or count in a day, in one place.
 *
 * Studies, DPPs, habits, topics left to revise, topics left to solve and the
 * to-do list used to be six unrelated cards and panels, two of which only echoed
 * each other. They are sections of one checklist now, and each is logged where
 * it is listed: no separate entry form to go and find.
 *
 * It reads the same stored data the scores are computed from, so nothing here
 * can disagree with the numbers — ticking a topic here and in the Topics card are
 * the same write. What the Topics card keeps is adding and organising topics.
 */
export default function MasterChecklist(props: MasterChecklistProps) {
  const log = props.log;
  const list = props.checklist;
  const academic = () => props.mode === 'academic';

  /** a track's score and priority, only where this mode actually scores it */
  const track = (id: TrackId) => {
    const scored = () => log.ordered().includes(id);
    return {
      score: () => (scored() ? log.scores()[id] : undefined),
      priority: () =>
        scored()
          ? {
              value: log.priorities()[id],
              onChange: (p: Parameters<typeof log.setTrackPriority>[1]) =>
                void log.setTrackPriority(id, p),
            }
          : undefined,
    };
  };
  const studiesTrack = track('studies');
  const dppsTrack = track('dpps');
  const habitsTrack = track('habits');
  const tasksTrack = track(academic() ? 'academic_tasks' : 'life_tasks');

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow px-4 sm:px-6 py-2">
      <Show when={academic()}>
        <ChecklistSection
          id="studies"
          title="Studies"
          icon={BookOpen}
          done={list.studies().done}
          total={list.studies().total}
          countLabel={`${log.today().study_hours} / ${log.user().target_study_hours}h`}
          score={studiesTrack.score()}
          priority={studiesTrack.priority()}
        >
          <HoursRow log={log} />
        </ChecklistSection>

        <ChecklistSection
          id="dpps"
          title="DPPs / Records"
          icon={ListChecks}
          done={list.dpps().done}
          total={list.dpps().total}
          score={dppsTrack.score()}
          priority={dppsTrack.priority()}
        >
          <DppRows log={log} />
        </ChecklistSection>
      </Show>

      {/* Habits are Life's track. Academic does not show them at all — they are
          neither scored nor listed there. */}
      <Show when={!academic()}>
        <ChecklistSection
          id="habits"
          title="Habits"
          icon={Repeat}
          done={list.habits().done}
          total={list.habits().total}
          score={habitsTrack.score()}
          priority={habitsTrack.priority()}
        >
          <HabitRows log={log} />
        </ChecklistSection>
      </Show>

      <Show when={academic()}>
        <ChecklistSection
          id="revise"
          title="Left to revise"
          icon={RefreshCw}
          done={list.reviseTally().done}
          total={list.reviseTally().total}
          note="not scored"
        >
          <TopicRows
            items={list.revise()}
            onToggle={(id) => void log.toggleTopic(id)}
            empty="Nothing left to revise. Add topics in the Topics card below."
          />
        </ChecklistSection>

        <ChecklistSection
          id="solve"
          title="Left to solve"
          icon={PenLine}
          done={list.solveTally().done}
          total={list.solveTally().total}
          note="not scored"
        >
          <TopicRows
            items={list.solve()}
            onToggle={(id) => void log.toggleTopic(id)}
            empty="Nothing left to solve. Add topics in the Topics card below."
          />
        </ChecklistSection>
      </Show>

      <ChecklistSection
        id="tasks"
        title="Action items"
        icon={ListTodo}
        done={list.tasksTally().done}
        total={list.tasksTally().total}
        score={tasksTrack.score()}
        priority={tasksTrack.priority()}
      >
        <TaskRows log={log} tasks={list.tasks()} mode={props.mode} />
      </ChecklistSection>
    </div>
  );
}

/** a −/+ button pair's button */
function Step(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      title={props.label}
      class="grid place-items-center w-8 h-8 flex-shrink-0 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
    >
      {props.children}
    </button>
  );
}

/** study hours: a stepper for the exact number, the slider for the quick sweep */
function HoursRow(props: { log: DailyLogState }) {
  const hours = () => props.log.today().study_hours;
  const set = (h: number) =>
    void props.log.patchToday({ study_hours: Math.min(12, Math.max(0, h)) });
  return (
    <div class="flex items-center gap-3 rounded-lg border border-border bg-background px-2.5 py-2">
      <Step label="Half an hour less" onClick={() => set(hours() - 0.5)} disabled={hours() <= 0}>
        <Minus size={14} />
      </Step>
      <input
        type="range"
        min="0"
        max="12"
        step="0.5"
        value={hours()}
        onInput={(e) => set(Number(e.currentTarget.value))}
        aria-label="Hours studied today"
        class="flex-1 min-w-0 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <Step label="Half an hour more" onClick={() => set(hours() + 0.5)} disabled={hours() >= 12}>
        <Plus size={14} />
      </Step>
    </div>
  );
}

/**
 * The day's DPPs, each with the topic it covers, the subject, and the teacher
 * who set it. Ticking one is the same act as before — the score still divides
 * "completed by assigned" — but the list is now where those two numbers come
 * from, so a DPP is a thing you can name rather than a box you can count.
 */
function DppRows(props: { log: DailyLogState }) {
  const log = props.log;
  const [subject, setSubject] = createSignal('');
  const [topic, setTopic] = createSignal('');
  const [teacher, setTeacher] = createSignal('');

  const submit = (e: Event) => {
    e.preventDefault();
    if (!topic().trim()) return;
    void log.addDpp(subject(), topic(), teacher());
    // subject and teacher are kept: a stack of DPPs from the same teacher is the
    // usual case, and only the topic changes from one to the next
    setTopic('');
  };

  /** the few most recent distinct values of a field, newest first */
  const recent = (pick: (d: DppItem) => string) => {
    const seen: string[] = [];
    for (const d of log.dpps()) {
      const v = pick(d).trim();
      if (v && !seen.includes(v)) seen.push(v);
      if (seen.length === 5) break;
    }
    return seen;
  };

  // A stored day from before DPPs had details holds only two counts. Say so, and
  // say what adding one will do to them — rather than silently replacing them.
  const legacy = () => {
    const t = log.today();
    return log.todayDpps().length === 0 && t.id !== 'unsaved' && t.dpps_got > 0 ? t : null;
  };

  const Chips = (p: { values: string[]; label: string; onPick: (v: string) => void }) => (
    <Show when={p.values.length > 0}>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[0.625rem] font-semibold text-muted-foreground">{p.label}</span>
        <For each={p.values}>
          {(v) => (
            <button
              type="button"
              onClick={() => p.onPick(v)}
              class="rounded-full border border-border bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              {v}
            </button>
          )}
        </For>
      </div>
    </Show>
  );

  return (
    <>
      <For each={log.todayDpps()}>
        {(d) => (
          <CheckRow
            checked={d.done}
            onToggle={() => void log.toggleDpp(d.id)}
            label={d.topic || 'Untitled DPP'}
            onDelete={() => void log.deleteDpp(d.id)}
            deleteLabel={`Remove DPP: ${d.topic}`}
            chips={
              <>
                <Show when={d.subject}>
                  <span class="text-[0.625rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {d.subject}
                  </span>
                </Show>
                <Show when={d.teacher}>
                  <span
                    class="text-[0.625rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                    title={`Given by ${d.teacher}`}
                  >
                    {d.teacher}
                  </span>
                </Show>
              </>
            }
          />
        )}
      </For>

      <Show when={legacy()}>
        {(t) => (
          <p class="rounded-lg border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
            {t().dpps_complete} of {t().dpps_got} DPPs were logged today as a plain count, before
            they carried a topic. Adding a DPP below replaces that count with the list.
          </p>
        )}
      </Show>
      <Show when={log.todayDpps().length === 0 && !legacy()}>
        <p class="text-xs text-muted-foreground py-1">
          No DPPs today — add each one you were given below.
        </p>
      </Show>

      <form onSubmit={submit} class="flex flex-wrap gap-2 pt-1">
        <input
          type="text"
          placeholder="Subject"
          aria-label="DPP subject"
          value={subject()}
          onInput={(e) => setSubject(e.currentTarget.value)}
          class="w-32 h-9 px-3 bg-background border border-border rounded-lg text-xs"
        />
        <input
          type="text"
          placeholder="Topic of the DPP"
          aria-label="DPP topic"
          value={topic()}
          onInput={(e) => setTopic(e.currentTarget.value)}
          class="flex-1 min-w-[10rem] h-9 px-3 bg-background border border-border rounded-lg text-xs"
        />
        <input
          type="text"
          placeholder="Teacher"
          aria-label="Teacher who gave the DPP"
          value={teacher()}
          onInput={(e) => setTeacher(e.currentTarget.value)}
          class="w-36 h-9 px-3 bg-background border border-border rounded-lg text-xs"
        />
        <button
          type="submit"
          class="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs flex items-center gap-1"
        >
          <PlusCircle size={14} /> Add
        </button>
      </form>
      <Chips values={recent((d) => d.subject)} label="Subjects" onPick={setSubject} />
      <Chips values={recent((d) => d.teacher)} label="Teachers" onPick={setTeacher} />
    </>
  );
}

function HabitRows(props: { log: DailyLogState }) {
  const log = props.log;
  const [name, setName] = createSignal('');
  const add = () => {
    void log.addHabit(name());
    setName('');
  };

  return (
    <>
      <For each={log.habits()}>
        {(h) => (
          <div class="flex items-center gap-2">
            <div class="flex-1 min-w-0">
              <CheckRow
                checked={log.doneIds().includes(h.id)}
                onToggle={() => void log.toggleHabit(h.id)}
                label={h.name}
                onDelete={() => void log.deleteHabit(h.id)}
                deleteLabel={`Remove habit: ${h.name}`}
              />
            </div>
            {/* a habit's own weight, beside it so the row's text keeps its width */}
            <PriorityPicker
              value={h.priority}
              onChange={(p) => void log.setHabitPriority(h.id, p)}
            />
          </div>
        )}
      </For>
      <Show when={log.habits().length === 0}>
        <p class="text-xs text-muted-foreground py-1">No habits yet — add one below.</p>
      </Show>
      <div class="flex gap-2 pt-1">
        <input
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a habit…"
          aria-label="New habit"
          class="flex-1 min-w-0 h-9 px-3 bg-background border border-border rounded-lg text-xs"
        />
        <button
          type="button"
          onClick={add}
          class="h-9 px-3 bg-muted hover:border-primary/40 border border-border rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </>
  );
}

/** a small grey badge — subject, chapter, kind */
function Chip(props: { text?: string; tone?: 'primary'; title?: string }) {
  return (
    <Show when={props.text}>
      <span
        title={props.title}
        class={`text-[0.625rem] px-1.5 py-0.5 rounded max-w-[10rem] truncate ${
          props.tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        {props.text}
      </span>
    </Show>
  );
}

function TopicRows(props: { items: TopicItem[]; onToggle: (id: string) => void; empty: string }) {
  return (
    <>
      <For each={props.items}>
        {(t) => (
          <CheckRow
            checked={t.done}
            onToggle={() => props.onToggle(t.id)}
            label={t.name}
            detail={t.note}
            chips={
              <>
                <Chip text={t.subject} />
                <Chip text={t.chapter} title={t.chapter} />
                <Show when={t.date !== todayIso()}>
                  <span class="text-[0.625rem] font-mono text-muted-foreground">
                    added {shortDate(t.date)}
                  </span>
                </Show>
              </>
            }
          />
        )}
      </For>
      <Show when={props.items.length === 0}>
        <p class="text-xs text-muted-foreground py-1">{props.empty}</p>
      </Show>
    </>
  );
}

function TaskRows(props: { log: DailyLogState; tasks: Task[]; mode: AppMode }) {
  const academic = () => props.mode === 'academic';
  const [title, setTitle] = createSignal('');
  const [subject, setSubject] = createSignal('');
  const [due, setDue] = createSignal('');
  const [kind, setKind] = createSignal('');
  const [chapter, setChapter] = createSignal('');
  const [reference, setReference] = createSignal('');
  const [problems, setProblems] = createSignal('');

  /** the reference fields only mean something for a reference task */
  const referenceOn = () => isReferenceKind(kind());

  const submit = (e: Event) => {
    e.preventDefault();
    if (!title().trim()) return;
    const count = Math.max(0, Math.floor(Number(problems()) || 0));
    void props.log.addTask(
      title(),
      subject(),
      due(),
      academic()
        ? {
            kind: kind(),
            chapter: chapter(),
            reference: referenceOn() ? reference() : '',
            problems: referenceOn() ? count : 0,
          }
        : undefined,
    );
    setTitle('');
    setSubject('');
    setDue('');
    setChapter('');
    setReference('');
    setProblems('');
    // the kind stays: several tasks of the same kind in a row is the usual case
  };

  /** "HC Verma · 20 problems", or whichever half is there */
  const referenceLine = (t: Task) =>
    [t.reference, t.problems ? `${t.problems} problems` : ''].filter(Boolean).join(' · ');

  const overdue = (t: Task) => !t.completed && t.due_date !== '' && t.due_date < todayIso();
  const dueChip = (t: Task) => (
    <span
      class={`text-[0.625rem] font-mono ${
        overdue(t)
          ? 'text-destructive font-semibold'
          : t.due_date === todayIso()
            ? 'text-primary font-semibold'
            : 'text-muted-foreground'
      }`}
    >
      {t.due_date === todayIso() ? 'today' : shortDate(t.due_date)}
    </span>
  );

  return (
    <>
      <For each={props.tasks}>
        {(t) => (
          <CheckRow
            checked={t.completed}
            onToggle={() => void props.log.toggleTask(t.id)}
            label={t.title}
            detail={referenceLine(t) || undefined}
            tone={overdue(t) ? 'overdue' : undefined}
            onDelete={() => void props.log.deleteTask(t.id)}
            deleteLabel={`Remove task: ${t.title}`}
            chips={
              <>
                <Chip text={t.kind} tone="primary" />
                <Chip text={t.subject} />
                <Chip text={t.chapter} title={t.chapter} />
                <Show when={t.due_date}>{dueChip(t)}</Show>
              </>
            }
          />
        )}
      </For>
      <Show when={props.tasks.length === 0}>
        <p class="text-xs text-muted-foreground py-1">Nothing to do — add an action item below.</p>
      </Show>

      <form onSubmit={submit} class="flex flex-wrap gap-2 pt-1">
        <input
          type="text"
          placeholder="What needs doing?"
          aria-label="New action item"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          class="flex-1 min-w-[10rem] h-9 px-3 bg-background border border-border rounded-lg text-xs"
        />
        <input
          type="text"
          placeholder={props.mode === 'academic' ? 'Subject' : 'Category'}
          aria-label="Subject or category"
          value={subject()}
          onInput={(e) => setSubject(e.currentTarget.value)}
          class="w-28 h-9 px-3 bg-background border border-border rounded-lg text-xs"
        />
        <input
          type="date"
          aria-label="Due date"
          value={due()}
          onInput={(e) => setDue(e.currentTarget.value)}
          class="w-36 h-9 px-3 bg-background border border-border rounded-lg text-xs text-muted-foreground [color-scheme:dark]"
        />
        <button
          type="submit"
          class="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs flex items-center gap-1"
        >
          <PlusCircle size={14} /> Add
        </button>

        {/* Session detail — Academic only. The reference fields are always drawn
            and only switched on for a reference task, so choosing a kind never
            makes the card grow. */}
        <Show when={academic()}>
          <div class="basis-full flex flex-wrap gap-2">
            <Combobox
              ariaLabel="Kind of task"
              placeholder="Kind (e.g. Practice PYQ)"
              value={kind()}
              onInput={setKind}
              options={props.log.kindOptions()}
              class="w-48"
            />
            <input
              type="text"
              placeholder="Chapter"
              aria-label="Chapter"
              value={chapter()}
              onInput={(e) => setChapter(e.currentTarget.value)}
              class="flex-1 min-w-[8rem] h-9 px-3 bg-background border border-border rounded-lg text-xs"
            />
            <input
              type="text"
              placeholder="Reference (e.g. HC Verma)"
              aria-label="Reference book or sheet"
              title={referenceOn() ? undefined : 'For Reference problems tasks'}
              disabled={!referenceOn()}
              value={reference()}
              onInput={(e) => setReference(e.currentTarget.value)}
              class="w-44 h-9 px-3 bg-background border border-border rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Problems"
              aria-label="Number of problems"
              title={referenceOn() ? undefined : 'For Reference problems tasks'}
              disabled={!referenceOn()}
              value={problems()}
              onInput={(e) => setProblems(e.currentTarget.value)}
              class="w-24 h-9 px-3 bg-background border border-border rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </Show>
      </form>
    </>
  );
}
