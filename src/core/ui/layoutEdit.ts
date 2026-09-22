import { createSignal } from 'solid-js';

/**
 * Whether Daily Log cards are draggable and resizable right now.
 *
 * View state, not stored data — it resets to off on every launch. Off by
 * default so nothing shifts under an ordinary click; it is toggled explicitly
 * from the sidebar, the same way the Daily Log gates its own risky actions
 * (submit-and-lock, unlock) behind an explicit step rather than a hover.
 */
const [editingLayout, setEditingLayout] = createSignal(false);
export { editingLayout, setEditingLayout };
