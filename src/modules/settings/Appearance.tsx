import { Check, Palette, RotateCcw, SlidersHorizontal } from 'lucide-solid';
import { For } from 'solid-js';

import {
  Card,
  DEFAULT_THEME,
  resetTheme,
  themeConfig,
  THEMES,
  Toggle,
  updateTheme,
  useSubViewLabel,
  Workspace,
  type ThemeId,
} from '../../core/ui';
import SampleData from './SampleData';

/**
 * A miniature app, drawn in a theme's own tokens.
 *
 * `data-theme-preview` makes themes.css hand this element that theme's whole
 * token set (the same block `<html data-theme>` uses), so the swatch is built
 * from the real colours, radii, strokes and glass — there is no second list of
 * hexes to fall out of step with the stylesheet. It is styled with the ordinary
 * token classes, exactly like the app it previews.
 */
function Preview(props: { id: ThemeId }) {
  return (
    <div
      data-theme-preview={props.id}
      aria-hidden="true"
      class="h-36 flex overflow-hidden rounded-2xl border border-border text-foreground"
      style={{
        'background-color': 'hsl(var(--background))',
        'background-image': 'var(--gradient-glow)',
        'background-size': 'cover',
      }}
    >
      <div class="w-9 flex-shrink-0 bg-sidebar border-r border-border p-2 flex flex-col items-center gap-2">
        <span class="w-4 h-4 rounded-md bg-primary" />
        <span class="w-4 h-1 rounded-full bg-muted-foreground" />
        <span class="w-4 h-1 rounded-full bg-border" />
        <span class="w-4 h-1 rounded-full bg-border" />
      </div>
      <div class="flex-1 min-w-0 p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold font-space">Aa 42</span>
          <span class="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--secondary-accent))' }} />
        </div>
        <div class="bg-card rounded-xl border border-border p-2 space-y-1.5 flex-1">
          <span class="block h-1.5 w-2/3 rounded-full bg-foreground" />
          <span class="block h-1.5 w-1/2 rounded-full bg-muted-foreground" />
          <span class="block h-1.5 w-full rounded-full bg-muted" />
        </div>
        <div class="flex gap-1.5">
          <span class="h-4 flex-1 rounded-lg bg-primary" />
          <span class="h-4 w-6 rounded-lg" style={{ background: 'hsl(var(--secondary-accent))' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Settings → Appearance & Themes.
 *
 * Every control writes through `updateTheme`, which sets the attribute on <html>
 * and saves in the same call — so what is on screen is always what will be there
 * next launch, and there is no separate "Apply" step to forget.
 */
export default function Appearance() {
  useSubViewLabel(() => 'Appearance & Sample Data');

  const config = themeConfig;
  const isDefault = () =>
    config().theme === DEFAULT_THEME.theme &&
    config().mono === DEFAULT_THEME.mono &&
    config().highContrast === DEFAULT_THEME.highContrast &&
    config().scanlines === DEFAULT_THEME.scanlines;

  return (
    <Workspace
      header={
        <p class="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Pick a look. It changes instantly and is remembered the next time MIS opens.
        </p>
      }
      footer={
        <button
          onClick={resetTheme}
          disabled={isDefault()}
          class="h-9 px-3 rounded-xl bg-muted border border-border text-xs font-semibold font-space flex items-center gap-2 hover:border-primary/40 transition-colors disabled:opacity-50 disabled:hover:border-border"
        >
          <RotateCcw size={13} /> Reset to default
        </button>
      }
      bodyClass="space-y-6"
    >
      <Card
        title="Theme"
        subtitle="six looks — each preview is drawn in that theme’s own colours"
        icon={Palette}
      >
        <div
          role="radiogroup"
          aria-label="Theme"
          class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <For each={THEMES}>
            {(t) => {
              const selected = () => config().theme === t.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected()}
                  onClick={() => updateTheme({ theme: t.id })}
                  class={`text-left rounded-2xl p-2 border transition-colors ${
                    selected()
                      ? 'border-primary bg-primary/[0.08]'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <Preview id={t.id} />
                  <div class="flex items-start justify-between gap-3 px-1.5 pt-3 pb-1">
                    <div class="min-w-0">
                      <p class="text-sm font-bold font-space truncate">{t.label}</p>
                      <p class="text-xs text-muted-foreground mt-0.5">{t.tagline}</p>
                      <p class="text-[0.6875rem] text-subtle-foreground mt-1">{t.note}</p>
                    </div>
                    {/* always drawn, dimmed when not selected: choosing a theme must
                        not change a card's height */}
                    <span
                      class={`flex-shrink-0 w-5 h-5 rounded-full grid place-items-center ${
                        selected()
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-transparent'
                      }`}
                    >
                      <Check size={12} />
                    </span>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </Card>

      <Card title="Type & effects" subtitle="these layer on top of any theme" icon={SlidersHorizontal}>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Toggle
            label="Monospaced font mode"
            description="Sets headings, numbers, inputs and data cards in a monospaced typeface."
            checked={config().mono}
            onChange={(mono) => updateTheme({ mono })}
          />
          <Toggle
            label="High-contrast borders"
            description="Doubles the border width and brightens the stroke on every card and divider."
            checked={config().highContrast}
            onChange={(highContrast) => updateTheme({ highContrast })}
          />
          <Toggle
            label="CRT scanlines"
            description={
              config().theme === 'terminal'
                ? 'A faint scanline texture over the whole window.'
                : 'Only available in Retro Terminal — choose it above to use this.'
            }
            checked={config().scanlines}
            disabled={config().theme !== 'terminal'}
            onChange={(scanlines) => updateTheme({ scanlines })}
          />
        </div>
      </Card>

      <SampleData />
    </Workspace>
  );
}
