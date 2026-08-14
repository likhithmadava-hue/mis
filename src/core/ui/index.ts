/**
 * The shared UI vocabulary: the pieces more than one module draws.
 *
 * Nothing in here knows what MIS stores. These take data and render it — which
 * is why the charts can be read on their own and why `Select` is the same
 * control in the Daily Log, the filter bar and the paper form. Anything that
 * knows about study hours or mistake reasons belongs in a module, not here.
 */

export { default as Card } from './Card';
export { default as Select, type SelectOption } from './Select';
export { PanelTile, PanelZoom, SeriesLabel, type PanelDef, type PanelView } from './Panel';
export {
  BarChart,
  Donut,
  EmptyChart,
  HBarList,
  TrendChart,
  type BarPoint,
  type DonutSegment,
  type HBar,
  type TrendPoint,
} from './charts';
export { createRailTooltip, type RailTooltip } from './railTooltip';
export { useFullscreen } from './useFullscreen';
export { TOPIC_ACTION, TOPIC_COLUMNS } from './labels';
export {
  DIFFICULTY_BADGE,
  DIFFICULTY_COLOR,
  REASON_BADGE,
  REASON_BAR,
  REASON_COLOR,
} from './mistakes';
export type { Icon } from './icon';
