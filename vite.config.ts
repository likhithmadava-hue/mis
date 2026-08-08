import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

/**
 * Vite's only job here is to build the frontend that Tauri embeds.
 *
 * The old React app built three different shapes — a single inlined HTML file
 * for `file://`, another with fonts inlined for sharing, and a split bundle for
 * Netlify. None of that applies any more. A Tauri app serves its frontend from
 * a real asset protocol inside the binary, so there is exactly one build: a
 * normal split bundle written to `dist/`, which `tauri.conf.json` points at as
 * `frontendDist`. No `viteSingleFile`, no font inlining, no `_redirects`.
 */
export default defineConfig({
  plugins: [solid()],

  // Tauri reads the app over a custom protocol, so assets must be referenced
  // relatively rather than from an absolute server root.
  base: './',

  // Vite's dev server is what `tauri dev` points its window at. The port is
  // pinned because tauri.conf.json's `devUrl` hardcodes it — letting Vite pick
  // the next free port on a collision would leave the window on a dead URL.
  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // WebView2 on Windows 10/11 is evergreen Chromium, so there is no reason
    // to down-compile for old browsers the way a web build must.
    target: 'chrome110',
    sourcemap: false,
  },

  // Rust owns every byte of data now; the frontend has no build-time flags to
  // inline. `VITE_FRESH_START` is gone — a fresh vault is decided by Rust at
  // first launch, not baked into the bundle.
  envPrefix: 'VITE_',
});
