import { Check, ChevronDown } from 'lucide-solid';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

/**
 * A dropdown built out of ordinary elements instead of a native `<select>`.
 *
 * Why not just use `<select>`? On Windows the popup list is drawn by a
 * half-native menu that ignores `option { background-color }`, so it came out
 * white against this app's dark theme no matter what CSS was thrown at it.
 * Owning the markup is the only reliable fix — and it lets the list show the
 * same coloured badges the tables use, which a `<select>` cannot do.
 *
 * That trade is only worth making if the replacement is a real listbox, so this
 * one is: it has the ARIA roles, it takes the keyboard (arrows, Home/End, Enter,
 * Escape, Tab), it returns focus to the trigger on close, and it flips upward
 * when there is no room below. A prettier control that could only be operated
 * with a mouse would be a downgrade dressed as an improvement.
 */

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** optional coloured pill drawn instead of plain text (see core/ui/mistakes.ts) */
  badgeClass?: string;
}

interface SelectProps<T extends string> {
  value: T;
  /**
   * `NoInfer` keeps `T` pinned to `value` — without it, a setter passed here
   * widens the whole component back to plain `string` and the option list stops
   * being checked against the value it sets.
   */
  onChange: (value: NoInfer<T>) => void;
  options: SelectOption<NoInfer<T>>[];
  /** describes the control to screen readers, e.g. "Filter by subject" */
  ariaLabel: string;
  class?: string;
}

export default function Select<T extends string>(props: SelectProps<T>) {
  const [open, setOpen] = createSignal(false);
  const [activeIdx, setActiveIdx] = createSignal(0);
  const [dropUp, setDropUp] = createSignal(false);

  let wrap!: HTMLDivElement;
  let trigger!: HTMLButtonElement;
  let list: HTMLUListElement | undefined;

  const selected = () => props.options.find((o) => o.value === props.value);
  const selectedIdx = () => Math.max(0, props.options.findIndex((o) => o.value === props.value));

  const openMenu = () => {
    setActiveIdx(selectedIdx());
    setOpen(true);
  };

  const commit = (option: SelectOption<T> | undefined) => {
    if (option) props.onChange(option.value);
    setOpen(false);
    trigger.focus();
  };

  // Clicking anywhere else closes the menu. The listener is added only while
  // the menu is open, so a screen full of Selects costs one listener, not one
  // per control.
  createEffect(() => {
    if (!open()) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrap.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    onCleanup(() => document.removeEventListener('mousedown', onPointerDown));
  });

  // Open upwards when the menu would run off the bottom of the window. Measured
  // at the moment of opening rather than on every render — the trigger does not
  // move while the list is down.
  createEffect(() => {
    if (!open()) return;
    const rect = trigger.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    setDropUp(roomBelow < 240 && rect.top > roomBelow);
  });

  // Keep the highlighted row visible while arrowing through a long list.
  createEffect(() => {
    const idx = activeIdx();
    if (!open()) return;
    list?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open()) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, props.options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIdx(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIdx(props.options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(props.options[activeIdx()]);
        break;
      case 'Tab':
        // Not prevented: Tab should still move on. The menu just shouldn't be
        // left hanging over whatever it lands on.
        setOpen(false);
        break;
    }
  };

  const Label = (p: { option: SelectOption<T> }) => (
    <Show
      when={p.option.badgeClass}
      fallback={<span class="truncate">{p.option.label}</span>}
    >
      <span class={`text-[0.625rem] font-bold px-2 py-0.5 rounded-md border ${p.option.badgeClass}`}>
        {p.option.label}
      </span>
    </Show>
  );

  return (
    <div ref={wrap} class={`relative ${props.class ?? ''}`}>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={props.ariaLabel}
        onClick={() => (open() ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        class="w-full h-9 pl-3 pr-2 bg-background border border-border rounded-xl text-xs text-foreground flex items-center justify-between gap-2 hover:border-primary/40 transition-colors"
      >
        <Show when={selected()} fallback={<span class="text-muted-foreground">Select…</span>}>
          {(option) => <Label option={option()} />}
        </Show>
        <ChevronDown
          size={14}
          class={`flex-shrink-0 text-muted-foreground transition-transform ${
            open() ? 'rotate-180' : ''
          }`}
        />
      </button>

      <Show when={open()}>
        <ul
          ref={list}
          role="listbox"
          aria-label={props.ariaLabel}
          class={`absolute z-40 left-0 min-w-full w-max max-w-[16rem] max-h-60 overflow-y-auto bg-card border border-border rounded-xl card-shadow p-1 animate-fade-in ${
            dropUp() ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <For each={props.options}>
            {(option, i) => (
              <li
                data-idx={i()}
                role="option"
                aria-selected={option.value === props.value}
                onClick={() => commit(option)}
                onMouseEnter={() => setActiveIdx(i())}
                class={`px-2.5 py-2 rounded-lg text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                  i() === activeIdx() ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Label option={option} />
                <Show when={option.value === props.value}>
                  <Check size={13} class="text-primary flex-shrink-0" />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
