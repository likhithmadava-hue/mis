import { For } from 'solid-js';

import { DONE_PROMPTS } from './constants';

interface DonePromptProps {
  /** which of the three questions is on screen */
  stage: number;
  onYes: () => void;
  onNo: () => void;
}

/**
 * The three-step confirmation a finished focus round has to pass before it is
 * written to the vault. "No" at any stage resets the whole round.
 *
 * This renders inside the timer's fullscreen container on purpose — a `fixed`
 * element outside the fullscreened node would not paint at all, and the alarm
 * would ring with nothing on screen to answer it.
 */
export default function DonePrompt(props: DonePromptProps) {
  const prompt = () => DONE_PROMPTS[props.stage];

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div class="bg-card border border-primary/30 rounded-2xl card-shadow glow-primary p-6 max-w-sm w-full space-y-4 text-center">
        <div class="text-4xl">{props.stage === DONE_PROMPTS.length - 1 ? '🌳' : '🌱'}</div>

        <div>
          <h3 class="text-lg font-bold font-space tracking-tight">{prompt().title}</h3>
          <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">{prompt().body}</p>
        </div>

        {/* how many of the three checks are done */}
        <div class="flex items-center justify-center gap-1.5">
          <For each={DONE_PROMPTS}>
            {(_, i) => (
              <span
                class={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i() <= props.stage ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </For>
        </div>

        <div class="flex flex-col gap-2 pt-1">
          <button
            onClick={props.onYes}
            class="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold font-space text-sm active:scale-95 transition-transform"
          >
            {prompt().yes}
          </button>
          <button
            onClick={props.onNo}
            class="px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:border-primary/40 active:scale-95 transition-all"
          >
            {prompt().no}
          </button>
        </div>
      </div>
    </div>
  );
}
