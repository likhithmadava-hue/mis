/**
 * Sign-in for MIS, on top of Supabase Auth.
 *
 *   client.ts        the one Supabase connection, and whether one exists at all
 *   AuthProvider.tsx who is signed in, and whether their data is ready
 *   LoginScreen.tsx  the sign-in / sign-up form
 *   AccountPanel.tsx the signed-in footer of the sidebar
 *
 * The rest of the app imports from here, never from a file inside — same
 * barrel rule the modules follow.
 */
export { supabase, isSupabaseConfigured, isFileBuild } from './client';
export { AuthProvider, useAuth, type AuthPhase } from './AuthProvider';
export { default as LoginScreen } from './LoginScreen';
export { default as AccountPanel } from './AccountPanel';
