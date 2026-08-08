import { createSignal, onCleanup, onMount } from 'solid-js';

/**
 * Fullscreens one element and reports whether it currently is.
 *
 * The state mirrors the document rather than tracking a flag of our own,
 * because Esc leaves fullscreen without going through `toggle` — anything
 * tracked here would be wrong the moment that happens, and the Focus Timer
 * would be left drawing an exit button over a window that had already exited.
 *
 * Note this is the *webview's* fullscreen, not the OS window's. In a Tauri
 * window they look the same to the user and behave the same way, and using the
 * standard API keeps the timer face working unchanged in `vite dev` in a plain
 * browser tab.
 */
export function useFullscreen(el: () => HTMLElement | undefined) {
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  onMount(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    onCleanup(() => document.removeEventListener('fullscreenchange', onChange));
  });

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el()?.requestFullscreen();
  };

  return { isFullscreen, toggle };
}
