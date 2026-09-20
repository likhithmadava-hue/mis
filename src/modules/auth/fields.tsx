import { Eye, EyeOff } from 'lucide-solid';
import { createSignal, For, Show, type JSX } from 'solid-js';

/**
 * The form pieces the onboarding wizard, the sign-in screen and the account
 * dialog share. One place, so a password field behaves the same wherever it
 * appears and the three screens cannot drift apart in height or focus style.
 */

/** one control height across every text, number, date and time field */
export const inputClass =
  'w-full h-11 px-3.5 bg-background border rounded-xl text-sm text-foreground [color-scheme:dark] placeholder:text-subtle-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-colors';

export const primaryButton =
  'h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold font-space flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';

export const quietButton =
  'h-11 px-4 rounded-xl bg-muted border border-border text-sm font-medium text-muted-foreground flex items-center justify-center gap-2 transition-colors hover:text-foreground hover:border-primary/30 disabled:opacity-40 disabled:pointer-events-none';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: JSX.Element;
  class?: string;
}

/** A label above a control, with a hint or an error beneath. */
export function Field(props: FieldProps) {
  return (
    <label class={`block ${props.class ?? ''}`}>
      <span class="block text-xs font-medium text-muted-foreground mb-1.5">{props.label}</span>
      {props.children}
      <Show
        when={props.error}
        fallback={
          <Show when={props.hint}>
            <span class="block mt-1.5 text-[0.6875rem] text-subtle-foreground leading-snug">
              {props.hint}
            </span>
          </Show>
        }
      >
        <span role="alert" class="block mt-1.5 text-[0.6875rem] text-destructive leading-snug">
          {props.error}
        </span>
      </Show>
    </label>
  );
}

interface TextInputProps {
  value: string;
  onInput: (value: string) => void;
  type?: 'text' | 'email' | 'number' | 'date' | 'time';
  placeholder?: string;
  autocomplete?: string;
  name?: string;
  min?: number | string;
  max?: number | string;
  maxLength?: number;
  invalid?: boolean;
  autofocus?: boolean;
  class?: string;
}

export function TextInput(props: TextInputProps) {
  return (
    <input
      type={props.type ?? 'text'}
      name={props.name}
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      placeholder={props.placeholder}
      autocomplete={props.autocomplete ?? 'off'}
      min={props.min}
      max={props.max}
      maxLength={props.maxLength}
      autofocus={props.autofocus}
      aria-invalid={props.invalid || undefined}
      class={`${inputClass} ${props.invalid ? 'border-destructive/60' : 'border-border'} ${props.class ?? ''}`}
    />
  );
}

interface PasswordInputProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  /** `current-password` on sign-in, `new-password` when choosing one */
  autocomplete: 'current-password' | 'new-password';
  name?: string;
  invalid?: boolean;
  autofocus?: boolean;
}

/** A password field with a show/hide toggle — typing a new password blind is how typos get set. */
export function PasswordInput(props: PasswordInputProps) {
  const [shown, setShown] = createSignal(false);
  return (
    <div class="relative">
      <input
        type={shown() ? 'text' : 'password'}
        name={props.name}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder={props.placeholder}
        autocomplete={props.autocomplete}
        autofocus={props.autofocus}
        aria-invalid={props.invalid || undefined}
        class={`${inputClass} pr-11 ${props.invalid ? 'border-destructive/60' : 'border-border'}`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown() ? 'Hide password' : 'Show password'}
        aria-pressed={shown()}
        tabIndex={-1}
        class="absolute inset-y-0 right-0 w-11 grid place-items-center text-subtle-foreground hover:text-foreground transition-colors"
      >
        <Show when={shown()} fallback={<Eye size={16} />}>
          <EyeOff size={16} />
        </Show>
      </button>
    </div>
  );
}

interface ChipsProps {
  options: readonly string[];
  selected: readonly string[];
  onToggle: (option: string) => void;
  ariaLabel: string;
}

/** Multi-select pills: the answer to "pick everything that applies". */
export function Chips(props: ChipsProps) {
  return (
    <div role="group" aria-label={props.ariaLabel} class="flex flex-wrap gap-2">
      <For each={props.options}>
        {(option) => {
          const on = () => props.selected.includes(option);
          return (
            <button
              type="button"
              role="checkbox"
              aria-checked={on()}
              onClick={() => props.onToggle(option)}
              class={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                on()
                  ? 'bg-primary/15 border-primary/50 text-primary'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
            >
              {option}
            </button>
          );
        }}
      </For>
    </div>
  );
}

interface RatingProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

/** 1–5, one row of buttons. Filled up to and including the chosen one. */
export function Rating(props: RatingProps) {
  return (
    <div role="radiogroup" aria-label={props.ariaLabel} class="flex gap-1">
      <For each={[1, 2, 3, 4, 5]}>
        {(n) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.value === n}
            aria-label={`${n} of 5`}
            onClick={() => props.onChange(n)}
            class={`w-7 h-7 rounded-lg border text-[0.6875rem] font-semibold font-mono transition-colors ${
              n <= props.value
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-background border-border text-subtle-foreground hover:border-primary/30'
            }`}
          >
            {n}
          </button>
        )}
      </For>
    </div>
  );
}
