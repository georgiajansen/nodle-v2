# Nodle

A private map of the people in your life: who they are, how you know them, who to catch up with, birthdays, favours, and a
private "character / risk" guide. Amber-on-black terminal look. It runs as a **static website on Vercel** and stores your data in **Supabase (free tier)**,
**end-to-end encrypted in your browser**: Supabase, Vercel and whoever built this cannot read it.

Plain HTML/CSS/JavaScript. No framework, no npm packages. Everything is in `src/`; `node build.js` makes the site in `dist/`.

## How the privacy works
- You log in with email + password (Supabase Auth). Then you unlock with a separate **vault passphrase**.
- The passphrase never leaves the browser. It makes a key with **PBKDF2-SHA256 (600,000 rounds, random 16-byte salt)**;
  the whole dataset is encrypted as **one blob with AES-256-GCM** (fresh random IV on each save, bound to your user id).
- The database table `vaults` has one row per user: `ciphertext, iv, salt, kdf_iter, version, updated_at`. Row-level security allows
  a user to read/insert/update only their own row. No anonymous access. No delete.
- `version` goes up by exactly 1 on each save, checked by the app **and** by a database trigger, so two devices can't silently overwrite each other.
- Optional per-device **PIN** (wraps the data key in this browser; erased after 5 wrong tries), **auto-lock** when idle (default 5 min),
  **Log out all devices**, **two-step sign-in (TOTP)**, encrypted **backup file** export/import.
- The site sends a strict Content-Security-Policy (only itself + your Supabase project), no inline scripts, no `eval`, supabase-js is bundled (no CDN).
- Limits are listed honestly in `DEPLOY.md` ("What is protected, honestly"), including the PIN caveat and "lost passphrase = lost data".

## Files
```
build.js              builds dist/ (reads SUPABASE_URL + SUPABASE_ANON_KEY, writes config.js, CSP, bundle)
vercel.json           build command + security headers
supabase/schema.sql   table, row-level security, version trigger
DEPLOY.md             beginner steps
src/index.html        page shell (login / unlock overlay lives here)
src/style.css theme.css extra.css
src/lib/              pmlib (parser), pmcrypto, pmvault (cloud sync + versions), pmrisk (risk score), intro (opening animation)
src/app/00..60_*.js   the app (state, graph, panels, dialogs, auth, start-up), concatenated in order
src/vendor/supabase.js  supabase-js 2.118.0 (UMD), SHA-256 ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3
tests/*.test.js       node tests (parser, crypto, PIN, version conflict, risk)
tests/e2e.py          headless-Chrome end-to-end with a fake Supabase; makes screenshots/
tests/mock_supabase.js  the fake (tests only, never shipped)
```

## Run the tests
```bash
npm test
SUPABASE_URL=https://dummy.supabase.co SUPABASE_ANON_KEY=dummy node build.js
python3 tests/e2e.py        # needs python3 + playwright + Chrome
```
`build.js` refuses to build without the two variables, and refuses a `service_role` / secret key.

## Needs a real Supabase to test
The fake follows the same rules, but only a real project can prove: real email/password login and session refresh; the row-level-security
policies and version trigger in `schema.sql`; TOTP two-step (and that it is enabled for the project); `signOut` with global scope;
the real supabase-js against the real API (CORS, error codes `40001`/`23505`); and the Supabase free-tier pause behaviour.
After deploying, do this checklist once: log in; create the passphrase; load demo data; reload; lock/unlock; open on a second browser and edit on both (expect the conflict choice); log out all devices.

## Demo data
Settings → Data → **Load demo data** adds 19 *fake* people so you can try everything. It is never loaded automatically.

## Importing birthdays
Settings → Import: paste a list of names and dates. It is read by plain code in your browser (no AI) and nothing is saved until you review it and press Confirm.
