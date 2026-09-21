import { Dynamic } from 'solid-js/web';

import type { TrackId } from '../../core/db';
import { heat, TRACK_META } from '../../core/scoring';
import type { DailyLogState } from './createDailyLog';
import PriorityPicker from './PriorityPicker';
import TrackControl from './TrackControl';

/**
 * A scored track that is a reading rather than a tick — mood, leisure,
 * wellness. These are not items you complete, so they stay as small cards beside
 * the checklist instead of being forced into it; the header still carries the
 * priority and score, so they are weighed exactly as before.
 */
export default function CheckInCard(props: { id: TrackId; log: DailyLogState }) {
  const meta = () => TRACK_META[props.id];
  const isHigh = () => props.log.priorities()[props.id] === 'high';

  return (
    <div
      class={`bg-card rounded-2xl border card-shadow p-4 space-y-3.5 ${
        isHigh() ? 'border-primary/30' : 'border-border'
      }`}
    >
      <div class="flex items-center gap-2.5 border-b border-border pb-3">
        <Dynamic
          component={meta().icon}
          size={16}
          class={`flex-shrink-0 ${isHigh() ? 'text-primary' : 'text-muted-foreground'}`}
        />
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-bold font-space truncate">{meta().label}</h4>
          <p class="text-[0.6875rem] text-muted-foreground truncate" title={meta().hint}>
            {meta().hint}
          </p>
        </div>
        <PriorityPicker
          value={props.log.priorities()[props.id]}
          onChange={(p) => void props.log.setTrackPriority(props.id, p)}
        />
        <span
          class={`w-8 h-8 flex-shrink-0 rounded-lg border flex items-center justify-center text-xs font-bold font-mono ${heat(
            props.log.scores()[props.id],
          )}`}
        >
          {Math.round(props.log.scores()[props.id])}
        </span>
      </div>
      <TrackControl id={props.id} log={props.log} />
    </div>
  );
}
