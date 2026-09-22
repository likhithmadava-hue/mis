import { ArrowLeft, ArrowRight, Lock, Plus, ShieldCheck, X } from 'lucide-solid';
import { createSignal, For, Match, Show, Switch } from 'solid-js';

import { Select } from '../../core/ui';
import AuthShell from './AuthShell';
import { CODE_STEP, createOnboarding, passwordStrength, STEPS, type Onboarding } from './createOnboarding';
import { Chips, Field, PasswordInput, primaryButton, quietButton, Rating, TextInput } from './fields';
import {
  GOALS,
  GRADES,
  PREFERENCES,
  PROGRAMS,
  SUBJECT_PRESETS,
  TIMES_OF_DAY,
} from './options';
import RecoveryCode from './RecoveryCode';

/**
 * First launch: the questionnaire, then an account, then the recovery code.
 *
 * It runs whenever the vault has no account — a brand-new install, and also an
 * existing install that predates accounts, whose data is untouched and simply
 * gets locked at the end.
 */
export default function OnboardingScreen() {
  const o = createOnboarding();

  return (
    <AuthShell wide>
      <Show
        when={o.step() < CODE_STEP}
        fallback={
          <RecoveryCode code={o.code() ?? ''} doneLabel="Open MIS" onDone={o.finish} />
        }
      >
        <Progress step={o.step()} />

        <div class="mt-6 mb-5">
          <h2 class="text-xl font-bold font-space tracking-tight">{STEPS[o.step()].title}</h2>
          <p class="text-sm text-muted-foreground mt-1">{STEPS[o.step()].blurb}</p>
        </div>

        <form
          class="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (o.step() === STEPS.length - 1) void o.submit();
            else o.next();
          }}
        >
          <Switch>
            <Match when={o.step() === 0}>
              <AboutYou o={o} />
            </Match>
            <Match when={o.step() === 1}>
              <Goals o={o} />
            </Match>
            <Match when={o.step() === 2}>
              <Subjects o={o} />
            </Match>
            <Match when={o.step() === 3}>
              <Rhythm o={o} />
            </Match>
            <Match when={o.step() === 4}>
              <Account o={o} />
            </Match>
          </Switch>

          <Show when={o.problem() ?? o.error()}>
            {(msg) => (
              <p role="alert" class="text-sm text-destructive">
                {msg()}
              </p>
            )}
          </Show>

          <div class="flex items-center justify-between gap-3 pt-1">
            <Show when={o.step() > 0} fallback={<span />}>
              <button type="button" onClick={o.back} disabled={o.busy()} class={quietButton}>
                <ArrowLeft size={15} /> Back
              </button>
            </Show>

            <Show
              when={o.step() < STEPS.length - 1}
              fallback={
                <button type="submit" disabled={o.busy()} class={primaryButton}>
                  <Lock size={15} />
                  {o.busy() ? 'Locking…' : 'Create account & lock MIS'}
                </button>
              }
            >
              <button type="submit" class={primaryButton}>
                Continue <ArrowRight size={15} />
              </button>
            </Show>
          </div>
        </form>
      </Show>
    </AuthShell>
  );
}

function Progress(props: { step: number }) {
  return (
    <div>
      <div class="flex items-center justify-between text-[0.6875rem] font-medium text-subtle-foreground mb-2">
        <span class="uppercase tracking-wider">
          Step {props.step + 1} of {STEPS.length}
        </span>
        <span>{STEPS[props.step].title}</span>
      </div>
      <div class="flex gap-1.5" aria-hidden="true">
        <For each={STEPS}>
          {(_, i) => (
            <div
              class={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i() <= props.step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </For>
      </div>
    </div>
  );
}

// ── Steps ───────────────────────────────────────────────────────────────────

function AboutYou(props: { o: Onboarding }) {
  const { d, setD } = props.o;
  return (
    <>
      <Field label="Full name">
        <TextInput
          value={d.fullName}
          onInput={(v) => setD('fullName', v)}
          placeholder="Your name"
          autocomplete="name"
          maxLength={80}
          autofocus
        />
      </Field>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Age">
          <TextInput
            type="number"
            value={d.age}
            onInput={(v) => setD('age', v)}
            placeholder="17"
            min={5}
            max={100}
          />
        </Field>
        <div>
          <span class="block text-xs font-medium text-muted-foreground mb-1.5">Class / level</span>
          <Select
            ariaLabel="Class or level"
            value={d.grade}
            onChange={(v) => setD('grade', v)}
            options={GRADES.map((g) => ({ value: g, label: g }))}
          />
        </div>
      </div>
    </>
  );
}

function Goals(props: { o: Onboarding }) {
  const { d, setD, toggle } = props.o;
  return (
    <>
      <div>
        <span class="block text-xs font-medium text-muted-foreground mb-1.5">
          What are you studying for?
        </span>
        <Select
          ariaLabel="Programme"
          value={d.program}
          onChange={(v) => setD('program', v)}
          options={PROGRAMS.map((p) => ({ value: p, label: p }))}
        />
      </div>

      <div>
        <span class="block text-xs font-medium text-muted-foreground mb-2">
          What do you want from MIS? <span class="text-subtle-foreground">(pick any)</span>
        </span>
        <Chips
          ariaLabel="Goals"
          options={GOALS}
          selected={d.goals}
          onToggle={(g) => toggle('goals', g)}
        />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Target exam" hint="Optional">
          <TextInput
            value={d.targetExam}
            onInput={(v) => setD('targetExam', v)}
            placeholder="JEE Main, Class 12 boards…"
            maxLength={80}
          />
        </Field>
        <Field label="Exam date" hint="Optional — leave blank if it isn’t fixed yet">
          <TextInput type="date" value={d.examDate} onInput={(v) => setD('examDate', v)} />
        </Field>
      </div>
      <Field label="Target score" hint="Optional — a percentage, a grade, a percentile, a rank">
        <TextInput
          value={d.targetScore}
          onInput={(v) => setD('targetScore', v)}
          placeholder="95%, A*, 99 percentile…"
          maxLength={40}
        />
      </Field>
    </>
  );
}

function Subjects(props: { o: Onboarding }) {
  const { d, setD, toggleSubject, addSubject } = props.o;
  const [custom, setCustom] = createSignal('');

  const add = () => {
    if (addSubject(custom())) setCustom('');
  };

  return (
    <>
      <div>
        <span class="block text-xs font-medium text-muted-foreground mb-2">Tap to add</span>
        <Chips
          ariaLabel="Subjects"
          options={SUBJECT_PRESETS}
          selected={d.subjects.map((s) => s.name)}
          onToggle={toggleSubject}
        />
      </div>

      <div class="flex gap-2">
        <TextInput
          value={custom()}
          onInput={setCustom}
          placeholder="Another subject…"
          maxLength={40}
        />
        <button
          type="button"
          onClick={add}
          disabled={!custom().trim()}
          aria-label="Add subject"
          class={`${quietButton} px-3.5`}
        >
          <Plus size={16} />
        </button>
      </div>

      <Show when={d.subjects.length > 0}>
        <div class="rounded-xl border border-border overflow-hidden">
          <div class="hidden sm:grid grid-cols-[1fr_auto_7.5rem_2rem] gap-3 px-4 py-2 bg-muted/50 text-[0.625rem] font-semibold uppercase tracking-wider text-subtle-foreground">
            <span>Subject</span>
            <span>How confident?</span>
            <span>Last result</span>
            <span />
          </div>
          <ul class="divide-y divide-border">
            <For each={d.subjects}>
              {(s, i) => (
                <li class="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_7.5rem_2rem] items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span class="text-sm font-medium truncate">{s.name}</span>
                  <Rating
                    ariaLabel={`Confidence in ${s.name}`}
                    value={s.confidence}
                    onChange={(n) => setD('subjects', i(), 'confidence', n)}
                  />
                  <input
                    value={s.lastResult}
                    onInput={(e) => setD('subjects', i(), 'lastResult', e.currentTarget.value)}
                    placeholder="B+, 72%…"
                    maxLength={40}
                    aria-label={`Last result in ${s.name}`}
                    class="h-8 px-2.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-primary/60 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSubject(s.name)}
                    aria-label={`Remove ${s.name}`}
                    class="w-8 h-8 grid place-items-center rounded-lg text-subtle-foreground hover:text-destructive hover:bg-destructive/10 transition-colors justify-self-end"
                  >
                    <X size={14} />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
        <p class="text-[0.6875rem] text-subtle-foreground">
          1 = shaky, 5 = confident. It’s only a starting guess — your logged mistakes will show how
          close it is.
        </p>
      </Show>
    </>
  );
}

function Rhythm(props: { o: Onboarding }) {
  const { d, setD, toggle } = props.o;
  const range = 'w-full accent-[hsl(var(--primary))] cursor-pointer';

  return (
    <>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <div class="flex items-baseline justify-between mb-1.5">
            <span class="text-xs font-medium text-muted-foreground">Study per day</span>
            <span class="font-mono text-sm font-semibold text-primary">{d.dailyHours} h</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={12}
            step={0.5}
            value={d.dailyHours}
            onInput={(e) => setD('dailyHours', Number(e.currentTarget.value))}
            aria-label="Study hours per day"
            class={range}
          />
        </div>
        <div>
          <div class="flex items-baseline justify-between mb-1.5">
            <span class="text-xs font-medium text-muted-foreground">Focus before drifting</span>
            <span class="font-mono text-sm font-semibold text-primary">{d.focusSpan} min</span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={d.focusSpan}
            onInput={(e) => setD('focusSpan', Number(e.currentTarget.value))}
            aria-label="Focus span in minutes"
            class={range}
          />
        </div>
      </div>

      <div>
        <span class="block text-xs font-medium text-muted-foreground mb-2">
          When do you work best?
        </span>
        <div role="radiogroup" aria-label="Most productive time" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <For each={TIMES_OF_DAY}>
            {(t) => (
              <button
                type="button"
                role="radio"
                aria-checked={d.productiveTime === t.value}
                onClick={() => setD('productiveTime', t.value)}
                class={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  d.productiveTime === t.value
                    ? 'bg-primary/15 border-primary/50'
                    : 'bg-background border-border hover:border-primary/30'
                }`}
              >
                <span
                  class={`block text-sm font-medium ${
                    d.productiveTime === t.value ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {t.label}
                </span>
                <span class="block text-[0.6875rem] text-subtle-foreground font-mono">{t.hint}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="rounded-xl border border-border p-4 space-y-3">
        <label class="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={d.hasSchool}
            onChange={(e) => setD('hasSchool', e.currentTarget.checked)}
            class="w-4 h-4 accent-[hsl(var(--primary))]"
          />
          <span class="text-sm font-medium">I have school or college hours</span>
        </label>
        <Show when={d.hasSchool}>
          <div class="grid grid-cols-2 gap-4">
            <Field label="Starts">
              <TextInput type="time" value={d.schoolStart} onInput={(v) => setD('schoolStart', v)} />
            </Field>
            <Field label="Ends">
              <TextInput type="time" value={d.schoolEnd} onInput={(v) => setD('schoolEnd', v)} />
            </Field>
          </div>
        </Show>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <Field label="Usual bedtime">
          <TextInput type="time" value={d.bedtime} onInput={(v) => setD('bedtime', v)} />
        </Field>
        <Field label="Usual wake-up">
          <TextInput type="time" value={d.wake} onInput={(v) => setD('wake', v)} />
        </Field>
      </div>

      <div>
        <span class="block text-xs font-medium text-muted-foreground mb-2">
          How do you like to study? <span class="text-subtle-foreground">(pick any)</span>
        </span>
        <Chips
          ariaLabel="Study preferences"
          options={PREFERENCES}
          selected={d.preferences}
          onToggle={(p) => toggle('preferences', p)}
        />
      </div>
    </>
  );
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
const STRENGTH_COLOR = ['', 'bg-destructive', 'bg-warning', 'bg-primary', 'bg-success'] as const;

function Account(props: { o: Onboarding }) {
  const { d, setD } = props.o;
  const strength = () => passwordStrength(d.password);

  return (
    <>
      <div class="flex items-start gap-2.5 rounded-xl bg-primary/[0.06] border border-primary/20 px-4 py-3">
        <ShieldCheck size={16} class="text-primary flex-shrink-0 mt-0.5" />
        <p class="text-[0.75rem] text-muted-foreground leading-relaxed">
          Your password encrypts your data — without it, MIS can’t be opened. It’s stored nowhere,
          so there’s no “reset by email”: you’ll get a recovery code on the next screen instead.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Username">
          <TextInput
            value={d.username}
            onInput={(v) => setD('username', v)}
            placeholder="vohrim"
            autocomplete="username"
            name="username"
            maxLength={24}
            autofocus
          />
        </Field>
        <Field label="Email" hint="Kept on your profile only">
          <TextInput
            type="email"
            value={d.email}
            onInput={(v) => setD('email', v)}
            placeholder="you@example.com"
            autocomplete="email"
            name="email"
            maxLength={254}
          />
        </Field>
      </div>

      <Field label="Password">
        <PasswordInput
          value={d.password}
          onInput={(v) => setD('password', v)}
          autocomplete="new-password"
          name="new-password"
          placeholder="At least 8 characters"
        />
        <Show when={d.password}>
          <div class="mt-2 flex items-center gap-2" aria-live="polite">
            <div class="flex gap-1 flex-1" aria-hidden="true">
              <For each={[1, 2, 3, 4]}>
                {(n) => (
                  <div
                    class={`h-1 flex-1 rounded-full transition-colors ${
                      n <= strength() ? STRENGTH_COLOR[strength()] : 'bg-muted'
                    }`}
                  />
                )}
              </For>
            </div>
            <span class="text-[0.6875rem] text-subtle-foreground w-12 text-right">
              {STRENGTH_LABEL[strength()]}
            </span>
          </div>
        </Show>
      </Field>

      <Field label="Confirm password">
        <PasswordInput
          value={d.confirm}
          onInput={(v) => setD('confirm', v)}
          autocomplete="new-password"
          name="confirm-password"
          invalid={d.confirm.length > 0 && d.confirm !== d.password}
        />
      </Field>
    </>
  );
}
