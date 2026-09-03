import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Icon } from './icon';

interface CardProps {
  title: string;
  subtitle?: string;
  icon: Icon;
  children: JSX.Element;
  class?: string;
}

/**
 * The titled panel every chart on the Growth Tracker sits in. One shell means
 * the header spacing, rule and icon treatment can't drift between cards.
 */
export default function Card(props: CardProps) {
  return (
    <div
      class={`bg-card rounded-2xl border border-border card-shadow p-4 sm:p-6 space-y-4 ${
        props.class ?? ''
      }`}
    >
      <div class="border-b border-border pb-3">
        <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
          <Dynamic component={props.icon} size={16} class="text-primary" /> {props.title}
        </h3>
        <Show when={props.subtitle}>
          <p class="text-[0.6875rem] text-muted-foreground mt-1">{props.subtitle}</p>
        </Show>
      </div>
      {props.children}
    </div>
  );
}
