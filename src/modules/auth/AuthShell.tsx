import { Sprout } from 'lucide-solid';
import type { JSX } from 'solid-js';

interface AuthShellProps {
  children: JSX.Element;
  /** the card can be wider for the wizard than for sign-in */
  wide?: boolean;
}

/**
 * The frame every pre-app screen sits in: the logo, then one card, centred.
 *
 * It is deliberately *not* the app's rail-and-content shell. Nothing here may
 * hint at what is behind the lock — no tabs, no numbers — so the only thing on
 * screen is the brand and the one thing being asked.
 */
export default function AuthShell(props: AuthShellProps) {
  return (
    <div class="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div class={`w-full ${props.wide ? 'max-w-[38rem]' : 'max-w-[27rem]'} animate-rise-in`}>
        <div class="flex items-center gap-3 mb-6 justify-center">
          <div class="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Sprout class="text-primary" size={22} />
          </div>
          <div>
            <h1 class="text-2xl font-bold font-space tracking-tight leading-none">MIS</h1>
            <p class="text-[0.6875rem] text-subtle-foreground font-medium mt-1">
              Mistake Intelligence System
            </p>
          </div>
        </div>

        <div class="bg-card border border-border rounded-2xl raised-shadow p-6 sm:p-8">
          {props.children}
        </div>

        <p class="mt-5 text-center text-[0.6875rem] text-subtle-foreground">
          Everything stays on this device. Nothing is uploaded anywhere.
        </p>
      </div>
    </div>
  );
}
