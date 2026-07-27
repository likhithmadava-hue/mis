import { DONE_PROMPTS } from './constants';

interface DonePromptProps {
  /** which of the three questions is on screen */
  stage: number;
  onYes: () => void;
  onNo: () => void;
}

/**
 * The three-step confirmation a finished focus round has to pass before it is
 * written to the database. "No" at any stage resets the whole round.
 *
 * This renders inside the timer's fullscreen container on purpose — a `fixed`
 * element outside the fullscreened node would not paint at all.
 */
export default function DonePrompt({ stage, onYes, onNo }: DonePromptProps) {
  const prompt = DONE_PROMPTS[stage];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-primary/30 rounded-2xl card-shadow glow-primary p-6 max-w-sm w-full space-y-4 text-center">
        <div className="text-4xl">{stage === DONE_PROMPTS.length - 1 ? '🌳' : '🌱'}</div>

        <div>
          <h3 className="text-lg font-bold font-space tracking-tight">{prompt.title}</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{prompt.body}</p>
        </div>

        {/* how many of the three checks are done */}
        <div className="flex items-center justify-center gap-1.5">
          {DONE_PROMPTS.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i <= stage ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={onYes}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold font-space text-sm active:scale-95 transition-transform"
          >
            {prompt.yes}
          </button>
          <button
            onClick={onNo}
            className="px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:border-primary/40 active:scale-95 transition-all"
          >
            {prompt.no}
          </button>
        </div>
      </div>
    </div>
  );
}
