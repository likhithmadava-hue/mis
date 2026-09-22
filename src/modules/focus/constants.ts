/** which phase of the pomodoro cycle the clock is in */
export type TimerMode = 'focus' | 'short' | 'long';

export const MODE_LABEL: Record<TimerMode, string> = {
  focus: 'Focus',
  short: 'Short Break',
  long: 'Long Break',
};

/** the tree grows as the focus session progresses (Arbor = tree); the last
 *  stage is a bloom, not another tree — a small payoff for finishing */
export const TREE_STAGES = ['🌰', '🌱', '🌿', '🍀', '🪴', '🌲', '🌳', '🌻'];

export const RING_RADIUS = 120;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The three questions asked when a focus round ends. Answering "no" at any
 * point resets the timer; only three "yes"es in a row end the session.
 *
 * The friction is the feature. One button between "the bell rang" and "the
 * session is logged" would be pressed reflexively; three deliberate answers
 * make stopping a decision rather than a habit.
 */
export const DONE_PROMPTS = [
  {
    title: 'Are you done?',
    body: 'Your focus round just finished.',
    yes: 'Yes, I’m done',
    no: 'No, keep going',
  },
  {
    title: 'Sure? Take one more look.',
    body: 'The last stretch is where the tree puts on most of its height. Is there something small you could still close out?',
    yes: 'Still done',
    no: 'Actually, one more round',
  },
  {
    title: 'Final check.',
    body: 'Tomorrow-you inherits whatever you leave on the table today. Calling it here?',
    yes: 'Call it — log the session',
    no: 'One last push',
  },
];
