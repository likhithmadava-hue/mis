import { useState, useEffect } from "preact/hooks";
import { type RefObject } from "preact";

/**
 * Fullscreens one element and reports whether it currently is.
 *
 * The state mirrors the browser rather than tracking our own flag, because Esc
 * leaves fullscreen without going through the toggle — anything we tracked
 * ourselves would be wrong the moment that happens.
 */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else ref.current?.requestFullscreen();
  };

  return { isFullscreen, toggle };
}
