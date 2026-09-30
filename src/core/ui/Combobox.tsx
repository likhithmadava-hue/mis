import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js';

/**
 * A text field that suggests values but never restricts them.
 *
 * `Select` is for a fixed set of choices; this is for free text with a memory —
 * a task's kind, where the app offers presets and whatever the student keeps
 * typing, but "Mock test review" is still a perfectly good answer the first time
 * it is typed. The suggestion list is drawn by us for the same reason `Select`
 * is: a native `<datalist>` is a white Windows popup on a dark app.
 *
 * It follows the ARIA 1.2 combobox pattern: the input keeps focus, arrows move a
 * highlight through the list, Enter takes the highlighted suggestion, Escape
 * closes the list. When nothing is highlighted, Enter is left alone, so it still
 * submits the form the field sits in.
 */

interface ComboboxProps {
  value: string;
  onInput: (value: string) => void;
  /** suggestions in the order they should appear; filtered here by what is typed */
  options: string[];
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  class?: string;
}

export default function Combobox(props: ComboboxProps) {
  const [open, setOpen] = createSignal(false);
  const [activeIdx, setActiveIdx] = createSignal(-1);
  const [dropUp, setDropUp] = createSignal(false);
  const listId = createUniqueId();

  let wrap!: HTMLDivElement;
  let input!: HTMLInputElement;
  let list: HTMLUListElement | undefined;

  const matches = createMemo(() => {
    const typed = props.value.trim().toLowerCase();
    return typed ? props.options.filter((o) => o.toLowerCase().includes(typed)) : props.options;
  });
  const showing = () => open() && !props.disabled && matches().length > 0;

  const openList = () => {
    if (props.disabled) return;
    setActiveIdx(-1);
    setOpen(true);
  };

  const pick = (value: string) => {
    props.onInput(value);
    setOpen(false);
    setActiveIdx(-1);
    input.focus();
  };

  // Close on a click anywhere else — the listener exists only while open.
  createEffect(() => {
    if (!open()) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrap.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    onCleanup(() => document.removeEventListener('mousedown', onPointerDown));
  });

  // Open upwards when there is no room below, measured as the list opens.
  createEffect(() => {
    if (!showing()) return;
    const rect = input.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    setDropUp(roomBelow < 220 && rect.top > roomBelow);
  });

  createEffect(() => {
    const idx = activeIdx();
    if (!showing() || idx < 0) return;
    list?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const count = matches().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open()) openList();
        setActiveIdx((i) => Math.min(i + 1, count - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        // only swallow Enter when it is choosing a suggestion
        if (showing() && activeIdx() >= 0) {
          e.preventDefault();
          pick(matches()[activeIdx()]);
        }
        break;
      case 'Escape':
        if (open()) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={wrap} class={`relative ${props.class ?? ''}`}>
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-label={props.ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showing()}
        aria-controls={listId}
        aria-activedescendant={
          showing() && activeIdx() >= 0 ? `${listId}-${activeIdx()}` : undefined
        }
        autocomplete="off"
        placeholder={props.placeholder}
        disabled={props.disabled}
        value={props.value}
        onInput={(e) => {
          props.onInput(e.currentTarget.value);
          openList();
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={onKeyDown}
        class="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <Show when={showing()}>
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={props.ariaLabel}
          class={`absolute z-40 left-0 min-w-full w-max max-w-[16rem] max-h-56 overflow-y-auto bg-card border border-border rounded-xl card-shadow p-1 animate-fade-in ${
            dropUp() ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <For each={matches()}>
            {(option, i) => (
              <li
                id={`${listId}-${i()}`}
                data-idx={i()}
                role="option"
                aria-selected={i() === activeIdx()}
                // mousedown, not click: the input would blur and close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActiveIdx(i())}
                class={`px-2.5 py-2 rounded-lg text-xs cursor-pointer truncate transition-colors ${
                  i() === activeIdx() ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
              >
                {option}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
