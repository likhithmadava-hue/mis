import { FlaskConical } from 'lucide-solid';
import { createSignal } from 'solid-js';

import { act, api } from '../../core/db';
import { Card, confirmDialog, messageDialog } from '../../core/ui';

/**
 * Settings → Sample data.
 *
 * Fills MIS with two weeks of made-up marks, mistakes, sessions and tasks so
 * every chart has something to draw — for looking around, or showing the app to
 * someone. It replaces what is logged, so it asks first, and Rust saves a copy of
 * the vault beside it before it does anything (see `db_reset`).
 */
export default function SampleData() {
  const [busy, setBusy] = createSignal(false);

  const load = async () => {
    const ok = await confirmDialog({
      title: 'Replace your data with sample data?',
      body:
        'Everything you have logged in MIS will be replaced by made-up sample marks, mistakes and tasks. ' +
        'Your account and password stay as they are. A copy of your current data is saved first, ' +
        'as a vault.before-sample file in the MIS data folder.',
      tone: 'danger',
      confirmLabel: 'Load sample data',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await act(api.dbReset(true));
      await messageDialog({
        title: 'Sample data loaded',
        body: 'Have a look around. Every mark, mistake and task you can see now is made up.',
        tone: 'info',
      });
    } catch (e) {
      await messageDialog({
        title: 'Sample data was not loaded',
        body: `${api.errorMessage(e)} Your data has not been changed.`,
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Sample data"
      subtitle="made-up marks and tasks, for looking around"
      icon={FlaskConical}
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p class="text-sm text-muted-foreground max-w-xl leading-relaxed">
          Fills MIS with two weeks of sample marks, mistakes, focus sessions and tasks so every chart
          has something to show. It replaces what you have logged, so a copy of your current data is
          saved first.
        </p>
        <button
          type="button"
          onClick={load}
          disabled={busy()}
          class="flex-shrink-0 h-9 px-3 rounded-xl bg-muted border border-border text-xs font-semibold font-space flex items-center gap-2 hover:border-primary/40 transition-colors disabled:opacity-50 disabled:hover:border-border"
        >
          <FlaskConical size={13} /> {busy() ? 'Loading…' : 'Load sample data'}
        </button>
      </div>
    </Card>
  );
}
