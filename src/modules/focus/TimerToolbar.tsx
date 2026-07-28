import { useState } from "preact/hooks";
import {
  CircleDashed,
  LayoutGrid,
  Maximize,
  Minimize,
  Settings2,
} from "lucide-preact";
import type { FocusSettings, TimerDesign } from "../../core/db";
import { MODE_LABEL, type TimerMode } from "./constants";

interface TimerToolbarProps {
  mode: TimerMode;
  onSwitchMode: (m: TimerMode) => void;
  settings: FocusSettings;
  onSetDesign: (d: TimerDesign) => void;
  onUpdateSetting: (key: NumericSetting, value: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

type NumericSetting =
  | "focus_minutes"
  | "short_break"
  | "long_break"
  | "rounds_before_long";

const DESIGNS = [
  { id: "ring", label: "Ring", Icon: CircleDashed },
  { id: "flip", label: "Flip", Icon: LayoutGrid },
] as const;

const SETTING_FIELDS: [NumericSetting, string][] = [
  ["focus_minutes", "Focus (min)"],
  ["short_break", "Short Break"],
  ["long_break", "Long Break"],
  ["rounds_before_long", "Rounds → Long"],
];

/**
 * Everything above the clock: which phase you're in, which face it wears, and
 * the gear that opens the durations. The settings live behind that gear rather
 * than in a permanent card — they're set once and then forgotten.
 */
export default function TimerToolbar({
  mode,
  onSwitchMode,
  settings,
  onSetDesign,
  onUpdateSetting,
  isFullscreen,
  onToggleFullscreen,
}: TimerToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="w-full flex flex-wrap items-center justify-center gap-3">
        <div className="flex bg-background p-1 rounded-xl border border-border gap-1">
          {(["focus", "short", "long"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onSwitchMode(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold font-space transition-colors ${
                mode === m
                  ? m === "focus"
                    ? "bg-primary text-primary-foreground"
                    : "bg-success text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {/* clock face + fullscreen */}
        <div className="flex items-center gap-2">
          <div className="flex bg-background p-1 rounded-xl border border-border gap-1">
            {DESIGNS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onSetDesign(id)}
                title={`${label} clock`}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold font-space flex items-center gap-1.5 transition-colors ${
                  settings.timer_design === id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-2 rounded-xl bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>

          <button
            onClick={() => setShowSettings((s) => !s)}
            title={`Timer settings — ${settings.focus_minutes}/${settings.short_break}/${settings.long_break} min`}
            aria-expanded={showSettings}
            className={`p-2 rounded-xl border transition-colors ${
              showSettings
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-background border-border text-muted-foreground hover:text-primary hover:border-primary/40"
            }`}
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="w-full p-4 bg-background border border-border rounded-xl animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SETTING_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-muted-foreground block mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={settings[key]}
                  onChange={(e) =>
                    onUpdateSetting(key, Number(e.currentTarget.value))
                  }
                  className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs font-mono"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
