import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * A dropdown built out of ordinary elements instead of a native <select>.
 *
 * Why not just use <select>? On Windows, Edge draws the popup list with a
 * half-native menu that ignores `option { background-color }`, so the list
 * came out white against this app's dark theme no matter what CSS we threw
 * at it. Owning the markup is the only reliable fix — and it lets the list
 * show the same coloured badges the tables use, which a <select> can't do.
 */

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** optional coloured pill drawn instead of plain text (see core/ui/mistakes.ts) */
  badgeClass?: string;
}

interface SelectProps<T extends string> {
  value: T;
  /** NoInfer keeps T pinned to `value` — without it a setState handler
      widens the whole component back to plain `string` */
  onChange: (value: NoInfer<T>) => void;
  options: SelectOption<NoInfer<T>>[];
  /** describes the control to screen readers, e.g. "Filter by subject" */
  ariaLabel: string;
  className?: string;
}

export default function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dropUp, setDropUp] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));

  const openMenu = () => {
    setActiveIdx(selectedIdx);
    setOpen(true);
  };

  const commit = (option: SelectOption<T> | undefined) => {
    if (option) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // clicking anywhere else closes the menu
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // open upwards when the menu would run off the bottom of the window
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    setDropUp(roomBelow < 240 && rect.top > roomBelow);
  }, [open]);

  // keep the highlighted row visible while arrowing through a long list
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
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
        setActiveIdx((i) => Math.min(i + 1, options.length - 1));
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
        setActiveIdx(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(options[activeIdx]);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const renderLabel = (option: SelectOption<T>) =>
    option.badgeClass ? (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${option.badgeClass}`}>
        {option.label}
      </span>
    ) : (
      <span className="truncate">{option.label}</span>
    );

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className="w-full h-9 pl-3 pr-2 bg-background border border-border rounded-xl text-xs text-foreground flex items-center justify-between gap-2 hover:border-primary/40 transition-colors"
      >
        {selected ? renderLabel(selected) : <span className="text-muted-foreground">Select…</span>}
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-40 left-0 min-w-full w-max max-w-[16rem] max-h-60 overflow-y-auto bg-card border border-border rounded-xl card-shadow p-1 animate-fade-in ${
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                data-idx={i}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(option)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`px-2.5 py-2 rounded-lg text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                  i === activeIdx ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
              >
                {renderLabel(option)}
                {isSelected && <Check size={13} className="text-primary flex-shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
