import { Show } from 'solid-js';

import { Segmented, viewState } from '../../core/ui';
import AudioPanel from './AudioPanel';
import type { AmbientSoundState } from './createAmbientSound';
import type { BrainwaveState } from './createBrainwave';
import type { FocusHabitsState } from './createFocusHabits';
import type { FocusMusicState } from './createFocusMusic';
import type { TasksTopicsState } from './createTasksTopics';
import type { FocusTimerState } from './createFocusTimer';
import TasksTopicsPanel from './TasksTopicsPanel';
import TimerSettingsPanel from './TimerSettingsPanel';

type View = 'audio' | 'tasks';

interface FocusSidebarProps {
  timer: FocusTimerState;
  music: FocusMusicState;
  ambient: AmbientSoundState;
  brainwave: BrainwaveState;
  habits: FocusHabitsState;
  tasks: TasksTopicsState;
}

/**
 * The column beside the clock: a switch, and one of two views under it.
 *
 * "Controls & Audio" is what you set before a round; "Tasks & Topics" is what
 * you look at during one. Choosing Tasks takes the audio controls off the screen
 * entirely rather than scrolling them out of it — the point of the switch is a
 * page with nothing else on it to fiddle with.
 */
export default function FocusSidebar(props: FocusSidebarProps) {
  // Which view is open survives a tab switch and a restart, like every other choice.
  const [view, setView] = viewState<View>('focus.sidebar', 'audio', (v) => v === 'audio' || v === 'tasks');

  // Built once, not inside the JSX: the switch reads its options in a `<For>`, and
  // options rebuilt whenever the badge changes would recreate the buttons and
  // drop the keyboard focus from the one you had just arrowed onto.
  const options = [
    { value: 'audio' as const, label: 'Controls & Audio' },
    {
      value: 'tasks' as const,
      label: (
        <span class="inline-flex items-center justify-center gap-2">
          Tasks &amp; Topics
          <Show when={props.tasks.pending() > 0}>
            <span
              class="min-w-5 px-1.5 rounded-full bg-muted text-foreground text-[0.6875rem] font-mono tabular-nums leading-5"
              title={`${props.tasks.pending()} still open`}
            >
              {props.tasks.pending()}
            </span>
          </Show>
        </span>
      ),
    },
  ];

  return (
    <div class="flex flex-col gap-4">
      <Segmented
        ariaLabel="Sidebar view"
        options={options}
        value={view()}
        onChange={setView}
      />

      {/* Hidden, not unmounted: the mute state lives in the audio panel, and a
          muted layer whose panel had been torn down would come back showing
          "unmuted" over a silent sound. `hidden` on a wrapper of its own —
          not on the flex container, whose `display` would win. */}
      <div classList={{ hidden: view() !== 'audio' }}>
        <div role="tabpanel" aria-label="Controls and audio" class="flex flex-col gap-4">
          <AudioPanel music={props.music} ambient={props.ambient} brainwave={props.brainwave} />
          <TimerSettingsPanel
            settings={props.timer.settings()}
            onUpdate={(key, value) => void props.timer.updateSetting(key, value)}
          />
        </div>
      </div>
      <Show when={view() === 'tasks'}>
        <div role="tabpanel" aria-label="Tasks and topics">
          <TasksTopicsPanel data={props.tasks} habits={props.habits} onFocus={props.timer.setTag} />
        </div>
      </Show>
    </div>
  );
}
