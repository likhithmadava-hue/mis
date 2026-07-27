import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two shapes of build, decided by mode:
//
//   default        the desktop build. dist/index.html is opened straight from
//                  disk by the shortcut, where browsers block separate JS module
//                  files — so viteSingleFile() inlines the JS and CSS into that
//                  one HTML file, and base is './' so it resolves next to itself.
//
//   mode 'fresh'   the hosted build (`npm run build:netlify`). Served by a real
//                  web server, so it ships normal split JS/CSS assets under
//                  /assets — smaller HTML, cached separately, updated one chunk
//                  at a time. base is '/' because Netlify serves it at the root.
//
// 'fresh' is the hosted build's mode (it also seeds empty — see .env.fresh), and
// nothing else uses it, so it doubles as the "this is the web build" switch.
export default defineConfig(({ mode }) => {
  const hosted = mode === 'fresh';
  return {
    base: hosted ? '/' : './',
    plugins: [react(), ...(hosted ? [] : [viteSingleFile()])],
  };
});
