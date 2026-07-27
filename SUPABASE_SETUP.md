# Turning on the MIS login

Right now nothing has changed: `.env.local` is empty, so MIS starts straight
into the app and saves to this computer only, exactly as before. Work through
this once and it grows a login screen and a cloud copy of your data.

Roughly 15 minutes. Steps 1–4 are the whole thing; step 5 (Google) is optional.

---

## 1. Create the Supabase project

1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub
   or an email.
2. **New project**.
   - **Name**: `mis`
   - **Database Password**: click Generate, then **save it in your password
     manager**. It is not the password you log into MIS with — it is the
     Postgres superuser password, and Supabase will not show it to you again.
   - **Region**: pick the one closest to you. `South Asia (Mumbai)` if you are
     in India — every save has to travel there and back.
3. Create, then wait ~2 minutes for it to finish provisioning.

## 2. Create the tables

1. In the left sidebar of your project, open **SQL Editor**.
2. Click **New query**.
3. Open `arbor/supabase/schema.sql` from this project, copy the whole file, and
   paste it in.
4. Press **Run** (or Ctrl+Enter).

You should see `Success. No rows returned`. That is what success looks like for
statements that create things rather than fetch things.

To check, open **Table Editor** in the sidebar — you should see eight tables:
`profiles`, `daily_metrics`, `mark_logbook`, `focus_sessions`, `tasks`,
`topics`, `habits`, `habit_log`. All empty, all marked **RLS enabled**.

> Re-running the file later is safe. Every statement either skips what already
> exists or replaces it, so it repairs the schema rather than wiping it. You
> will run it again if you ever add a field to `src/core/db/types.ts`.

## 3. Paste the keys into MIS

1. In Supabase: **Project Settings** (the gear, bottom left) → **API**.
2. Copy **Project URL** and the **anon** / **public** key.
3. Open `arbor/.env.local` and fill in the two lines:

   ```
   VITE_SUPABASE_URL=https://abcdefghijklm.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...long...string
   ```

4. **Restart `npm run dev`.** Vite only reads env files at startup, so a running
   dev server will not pick these up.

**About the anon key:** it is public on purpose, and it ends up visible inside
the built HTML. That is fine — on its own it can read nothing. The row-level
security policies from step 2 are what grant access, and they only ever match
rows belonging to whoever is signed in.

**The `service_role` key on that same page is the opposite.** It ignores every
policy. Never put it in `.env.local`, in the app, or anywhere a browser can see
it.

## 4. Make your account

`npm run dev`, open http://localhost:5173, and you should now get the login
screen.

1. **Create an account** → your email and a password → **Create account**.
2. Supabase emails you a confirmation link by default. Click it, come back, and
   sign in.
3. If MIS already had data on this computer, it offers to bring it in — a banner
   at the top of the page. Look before you click: the desktop build ships two
   weeks of *sample* rows on first run, and you probably do not want those in
   your real account.

The account button at the bottom of the sidebar shows whether your work has
reached the cloud. **Backed up** means it is up there. It is worth knowing the
difference, because MIS always saves to this computer first and uploads after —
which is exactly why it keeps working with the wifi off.

> **Not getting the confirmation email?** During development you can switch it
> off: **Authentication → Sign In / Providers → Email → Confirm email**, turn it
> off, Save. Turn it back on before anyone else uses MIS.

---

## 5. Google sign-in (optional)

Email and password works without this. Google needs a second account set up at
Google's end, so leave it until you want it.

1. **https://console.cloud.google.com** → create a project.
2. **APIs & Services → OAuth consent screen** → External → fill in an app name
   and your email → Save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → **Web application**.
4. Under **Authorised redirect URIs**, add the callback URL Supabase gives you.
   Find it in Supabase under **Authentication → Sign In / Providers → Google**;
   it looks like `https://<your-project-ref>.supabase.co/auth/v1/callback`.
5. Create. Copy the **Client ID** and **Client secret**.
6. Back in Supabase: **Authentication → Sign In / Providers → Google** → enable
   it, paste both, Save.

Until you do this, the **Continue with Google** button will come back with a
"provider is not enabled" message.

---

## 6. Where MIS is allowed to send you back to

A magic link and a Google sign-in both work by sending your browser to a URL
after you have proved who you are. Supabase will only redirect to addresses you
have listed.

**Authentication → URL Configuration**:

- **Site URL** — the main address. `http://localhost:5173` while developing;
  your Netlify address once it is hosted.
- **Redirect URLs** — add every address MIS runs at, one per line:
  ```
  http://localhost:5173
  http://localhost:5173/**
  https://your-site.netlify.app
  https://your-site.netlify.app/**
  ```

If a sign-in link dumps you on the wrong page or errors, this is nearly always
the reason.

---

## What the desktop copy can and cannot do

`Arbor.lnk` opens `dist/index.html` as a file on disk, not a web address.

- **Email and password** works there. It needs no redirect.
- **Magic links and Google do not**, and the login screen hides them and says
  why. Neither Google nor Supabase will redirect a browser to
  `file:///C:/Users/…/index.html`.
- Everything else is identical: same account, same data, same sync.

---

## When it goes wrong

| What you see | What it means |
|---|---|
| No login screen at all | `.env.local` is empty, or `npm run dev` was not restarted after filling it in |
| **Not backed up** in the sidebar, hover says `relation "public.profiles" does not exist` | Step 2 was not run, or was run against a different project |
| **Not backed up**, hover mentions `row-level security` | The schema ran but the policies did not — re-run `schema.sql`, it is safe |
| `Invalid login credentials` | Wrong password, **or** the account exists but the confirmation email was never clicked |
| Google says "provider is not enabled" | Step 5 is not done |
| A magic link lands somewhere odd | Step 6 — the address is not in the redirect list |

Nothing here can lose your work. MIS writes to this computer before it writes to
Supabase, so a sync that fails is a sync that retries — when you come back
online, when you next save, or when you press **Try syncing again** in the
account menu.

---

## Once it is hosted

`npm run build:netlify` bakes the same keys into `dist-netlify/index.html`, so
the hosted copy needs no extra configuration — only the redirect URLs from step
6. Add your Netlify address there before you sign in from it.
