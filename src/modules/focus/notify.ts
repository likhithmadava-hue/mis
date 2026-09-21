import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

/**
 * A native Windows notification for a round that ends while MIS is behind
 * another window — the alarm is a sound, this is the thing you can still see.
 *
 * Skipped when MIS has focus: the dialog is already in front of you and a
 * toast on top of it is noise. Best-effort like the audio: a denied permission
 * or a missing notification service must never break the timer.
 */
export const notifyRoundEnded = async (title: string, body: string) => {
  try {
    if (document.hasFocus()) return;
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title, body });
  } catch {
    // notifications unavailable — the alarm and the dialog still fire
  }
};
