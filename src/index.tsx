/**
 * Where the app starts.
 *
 * The database is loaded *before* anything renders. That ordering is the point:
 * every screen in MIS is a view of stored data, and a component that mounts
 * against an empty database draws an empty state for a fraction of a second —
 * "no papers yet", "0 h studied" — over data that exists. The old app flickered
 * exactly like that on every launch. Waiting here costs a few milliseconds
 * reading a local file and removes the whole class of problem.
 *
 * If the load fails there is nothing to render and no point pretending
 * otherwise, so the failure is shown in the window instead. (A vault that could
 * not be *opened* never gets this far — `lib.rs` catches that before the window
 * exists and says so in a message box.)
 */

import { render } from 'solid-js/web';

import App from './App';
import { boot } from './core/db';
import { errorMessage } from './core/db/api';

import './index.css';

const root = document.getElementById('root')!;

boot().then(
  () => render(() => <App />, root),
  (e: unknown) => render(() => <BootFailure detail={errorMessage(e)} />, root),
);

/**
 * The one screen that is not a view of the database, because there isn't one.
 *
 * It says where the data is and states plainly that nothing was touched. A
 * person who sees this is worried about their history, and the first thing they
 * need is to be told it is still on the disk.
 */
function BootFailure(props: { detail: string }) {
  return (
    <div class="min-h-dvh grid place-items-center p-8">
      <div class="max-w-xl space-y-4 rounded-xl border border-destructive/40 bg-card p-8 card-shadow">
        <h1 class="text-xl font-semibold">MIS could not load your data</h1>
        <p class="text-sm text-muted-foreground">
          Your vault has not been changed or deleted. Nothing was written.
        </p>
        <pre class="select-text overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-destructive">
          {props.detail}
        </pre>
        <p class="text-sm text-muted-foreground">
          Close MIS and open it again. If this keeps happening, your vault is in{' '}
          <code class="select-text font-mono text-foreground">%LOCALAPPDATA%\MIS</code> — copy that
          folder somewhere safe before trying anything else.
        </p>
      </div>
    </div>
  );
}
