import type { JSX } from 'solid-js';
import { children, Show } from 'solid-js';

interface WorkspaceProps {
  /** pinned to the top: page controls, a toolbar, the filters */
  header?: JSX.Element;
  /** pinned to the bottom: a quote, totals, a hint. Never floats mid-page. */
  footer?: JSX.Element;
  children: JSX.Element;
  /**
   * Scroll the body inside the workspace instead of letting the page grow.
   * For a body that is a long list (the logbook table): the header and footer
   * stay in view and only the rows move.
   */
  scroll?: boolean;
  class?: string;
  /** classes for the body cell — e.g. `flex flex-col` so a child can `flex-1` */
  bodyClass?: string;
}

/**
 * The layout every screen's central panel is built on: three rows,
 * `auto · 1fr · auto`.
 *
 * The header and footer take exactly the height of their content; the body
 * takes *everything else*. That is the whole point — on a tall window the
 * primary thing (the timer, the charts, the table) grows into the free space,
 * and the secondary thing is pinned to the bottom edge, instead of the page
 * ending early and leaving a dead band underneath.
 *
 * Rules for whoever builds the next screen:
 *  - Put the thing the screen exists for in the body and let it fill; do not
 *    give it a fixed height or a `mt-*` to push it around.
 *  - Never add a spacer div to "balance" a page. If a region should grow, it
 *    is the body; if it should not, it is the header or footer.
 *  - Rows have no `gap`: an empty track would still be charged one. Spacing
 *    lives on the header/footer cells, which only exist when they have content.
 */
export default function Workspace(props: WorkspaceProps) {
  // JSX passed as a prop is rebuilt on every read. `<Show when={props.header}>`
  // plus `{props.header}` would therefore build the header twice — two toolbars,
  // and a `ref` inside it landing on the copy that was thrown away. `children()`
  // resolves each slot once and hands back the same nodes.
  const header = children(() => props.header);
  const footer = children(() => props.footer);

  return (
    <div
      class={`grid w-full flex-1 min-h-0 ${
        props.scroll ? 'grid-rows-[auto_minmax(0,1fr)_auto]' : 'grid-rows-[auto_1fr_auto]'
      } ${props.class ?? ''}`}
    >
      <Show when={header()}>
        <div class="row-start-1 pb-4 min-w-0">{header()}</div>
      </Show>
      <div
        class={`row-start-2 min-w-0 min-h-0 ${props.scroll ? 'overflow-y-auto' : ''} ${
          props.bodyClass ?? ''
        }`}
      >
        {props.children}
      </div>
      <Show when={footer()}>
        <div class="row-start-3 pt-4 min-w-0">{footer()}</div>
      </Show>
    </div>
  );
}
