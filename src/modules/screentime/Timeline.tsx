import { createMemo, For, Show } from 'solid-js';

import type { TimelineSpan } from '../../core/db';
import { CATEGORY_COLOR, clockOf, humanise, type Category } from './format';

/**
 * The day as one strip: every recorded block in the order it happened.
 *
 * The strip spans only the hours that actually have something in them, rounded
 * outward to the hour. A fixed midnight-to-midnight axis would spend most of
 * its width on the hours you were asleep and squeeze the evening into a few
 * pixels.
 *
 * **Gaps are left as gaps.** An empty run in the middle of the strip means the
 * screen was idle, MIS was closed, or the machine was off — the chart does not
 * distinguish between those and does not pretend to.
 */
export default function Timeline(props: {
  blocks: TimelineSpan[];
  categoryOf: (app: string) => Category;
}) {
  const axis = createMemo(() => {
    if (props.blocks.length === 0) return null;
    const first = Math.min(...props.blocks.map((b) => b.start));
    const last = Math.max(...props.blocks.map((b) => b.start + b.seconds));
    const from = Math.floor(first / 3600) * 3600;
    const to = Math.min(86400, Math.ceil(last / 3600) * 3600);
    const span = Math.max(1, to - from);

    const hours: number[] = [];
    for (let h = from; h <= to; h += 3600) hours.push(h);
    // a long day would otherwise print a label every few pixels
    const labelEvery = hours.length > 14 ? 3 : hours.length > 8 ? 2 : 1;

    return { from, span, hours, labelEvery };
  });

  return (
    <Show when={axis()}>
      {(a) => (
        <div class="space-y-2">
          <div class="relative w-full h-9 bg-background rounded-lg overflow-hidden border border-border">
            <For each={props.blocks}>
              {(b) => (
                <div
                  title={`${clockOf(b.start)}  ${b.app} — ${humanise(b.seconds)}${
                    b.title ? `\n${b.title}` : ''
                  }`}
                  class="absolute top-0 bottom-0 hover:brightness-125 transition-[filter]"
                  style={{
                    left: `${((b.start - a().from) / a().span) * 100}%`,
                    // never thinner than a hairline, or a two-minute block vanishes
                    width: `${Math.max((b.seconds / a().span) * 100, 0.25)}%`,
                    background: CATEGORY_COLOR[props.categoryOf(b.app)],
                  }}
                />
              )}
            </For>
          </div>

          <div class="flex justify-between">
            <For each={a().hours}>
              {(h, i) => (
                <span class="text-[0.5625rem] text-muted-foreground font-mono">
                  {i() % a().labelEvery === 0 ? clockOf(h) : ''}
                </span>
              )}
            </For>
          </div>
        </div>
      )}
    </Show>
  );
}
