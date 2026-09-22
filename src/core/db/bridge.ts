/**
 * Picks the transport `api.ts` calls into: Tauri's `invoke` on desktop, the
 * `MisBackend` Capacitor plugin (Kotlin, `android/app/.../plugin/MisPlugin.kt`)
 * on Android. Nothing above `api.ts` knows this choice exists.
 *
 * **Wire convention on the Capacitor path**: `PluginCall.resolve()` on the
 * Kotlin side can only ever resolve a JSON *object*, never a bare
 * array/boolean/string/number the way Tauri's `invoke` can. `MisPlugin`
 * therefore wraps every resolved value as `{ value: <payload> }`, uniformly —
 * so this file unwraps `.value` on every call rather than per-command, which
 * would be one more place for the two sides to quietly drift apart.
 *
 * A Capacitor plugin-call rejection is expected to already carry `message`
 * (and, for the day-locked/not-found/screen-time cases `MisPlugin` throws
 * deliberately, a `code`) directly on the rejected value, matching Tauri's
 * `MisError` shape closely enough for `isMisError`/`errorMessage` in `api.ts`
 * to keep working unchanged — this is Capacitor's documented behaviour, not
 * verified against a real build on this machine (no Android SDK installed
 * here), so treat it as the most likely shape rather than a guarantee.
 */
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface MisBackendPlugin {
  invoke(options: { cmd: string; args: Record<string, unknown> }): Promise<{ value?: unknown }>;
}

const MisBackend = registerPlugin<MisBackendPlugin>('MisBackend');

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (Capacitor.isNativePlatform()) {
    const result = await MisBackend.invoke({ cmd, args: args ?? {} });
    return result.value as T;
  }
  return tauriInvoke<T>(cmd, args);
}
