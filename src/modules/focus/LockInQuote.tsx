import { Dices } from 'lucide-solid';

interface LockInQuoteProps {
  text: string;
  visible: boolean;
  onNext: () => void;
}

/** The rotating line under the timer controls. Layout only — see `createLockInQuote`. */
export default function LockInQuote(props: LockInQuoteProps) {
  return (
    <div class="w-full max-w-md mx-auto flex items-start gap-3 pt-2 border-t border-border/60">
      <p
        aria-live="polite"
        class="flex-1 min-h-[3.25rem] pt-3 text-center text-[0.9375rem] font-medium font-space leading-relaxed text-balance text-muted-foreground transition-all duration-200"
        classList={{ 'opacity-0 translate-y-1': !props.visible }}
      >
        “{props.text}”
      </p>
      <button
        onClick={props.onNext}
        title="Another line"
        aria-label="Another line"
        class="mt-3 flex-shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Dices size={16} />
      </button>
    </div>
  );
}
