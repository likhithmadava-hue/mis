import type { JSX } from 'solid-js';

interface ToggleProps {
  label: string;
  description: JSX.Element;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

/**
 * A labelled on/off row. The whole row is the switch, so the target is the size
 * of the text rather than a 32px pill — and the track and thumb are the only
 * parts that move, so toggling never changes the row's height.
 */
export default function Toggle(props: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      class="w-full flex items-center justify-between gap-4 text-left rounded-xl border border-border bg-muted px-4 py-3 transition-colors hover:border-primary/40 disabled:opacity-60 disabled:hover:border-border"
    >
      <span class="min-w-0">
        <span class="block text-sm font-semibold font-space">{props.label}</span>
        <span class="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {props.description}
        </span>
      </span>
      <span
        aria-hidden="true"
        class={`flex-shrink-0 w-10 h-[1.375rem] rounded-full p-0.5 flex transition-colors ${
          props.checked ? 'bg-primary justify-end' : 'bg-border justify-start'
        }`}
      >
        <span
          class={`w-[1.125rem] h-[1.125rem] rounded-full ${
            props.checked ? 'bg-primary-foreground' : 'bg-muted-foreground'
          }`}
        />
      </span>
    </button>
  );
}
