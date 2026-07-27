/// <reference types="vite/client" />

/**
 * Build-time switches Vite inlines into the bundle. `.env.fresh` sets the
 * hosted-copy flag; see scripts/postbuild.mjs and `npm run build:netlify`.
 */
interface ImportMetaEnv {
  /** 'true' in the hosted build: a brand-new visitor starts with no data */
  readonly VITE_FRESH_START?: string;
  /** Supabase project URL — set in `.env.local`, blank means "no login, local only" */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/public key. Safe to ship; row-level security is what protects data. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
