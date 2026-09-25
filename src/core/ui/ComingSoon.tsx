import { Lock } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Icon } from './icon';

interface ComingSoonProps {
  icon: Icon;
  title: string;
  /** what it will do, in one sentence — so the placeholder still earns its space */
  description: string;
  class?: string;
  children?: JSX.Element;
}

/**
 * A feature that is planned and does not exist yet.
 *
 * It must never be mistaken for a *working* panel that happens to read zero
 * (the Carelessness index with nothing logged), so it borrows none of the live
 * styling: a dashed outline, a flat surface, a lock and a "Coming soon" badge,
 * and `aria-disabled` so assistive tech says the same thing the dashes do. Live
 * panels are solid, tinted and interactive; this one is deliberately none of
 * those.
 */
export default function ComingSoon(props: ComingSoonProps) {
  return (
    <section
      aria-disabled="true"
      class={`rounded-2xl border border-dashed border-border bg-transparent p-5 flex items-center gap-4 select-none ${
        props.class ?? ''
      }`}
    >
      <div class="grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl border border-dashed border-border text-subtle-foreground">
        <Dynamic component={props.icon} size={18} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-bold font-space text-muted-foreground">{props.title}</h3>
          <span class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
            <Lock size={10} /> Coming soon
          </span>
        </div>
        <p class="text-xs text-subtle-foreground mt-1 leading-relaxed">{props.description}</p>
        {props.children}
      </div>
    </section>
  );
}
