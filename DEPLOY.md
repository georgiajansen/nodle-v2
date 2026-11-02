# Putting Nodle online (plain steps)

You need two free accounts: **Supabase** (the cloud storage + login) and **Vercel** (puts the website online).
Nothing here costs money on the free tiers. Total time: about 15 minutes.

> The app is already finished. You never edit code. You only copy two values from Supabase into Vercel.

---

## Part 1: Supabase (storage + login)

1. Go to <https://supabase.com> → **New project**. Pick any name (e.g. `nodle`), choose a region close to you
   (for Singapore pick *Southeast Asia (Singapore)*), and make a database password. Save that password in your
   password manager; the app never needs it.
2. When the project is ready, open **SQL Editor → New query**. Open the file `supabase/schema.sql` from this folder,
   copy everything, paste it in, press **Run**. You should see "Success". (Safe to run twice.)
3. **Sign-ups are open (public self sign-up).** Anyone can create their own account from the app's "Create account" link
   (for example employers looking at a portfolio demo). Keep **Authentication → Sign In / Providers → Email → "Allow new users to sign up"** switched **ON**.
   - Each account only ever sees its **own** encrypted vault row (row-level security in `schema.sql`), and the contents are encrypted in the browser with that person's own passphrase.
   - **Email confirmation:** if "Confirm email" is ON in Supabase, a new user sees "Check your email to confirm, then sign in." and must click the link first.
     If it is OFF, they go straight on to making their vault passphrase. Either works. The free built-in mailer is rate limited, so ON can fail under load; OFF is simpler for a demo.
   - **To close sign-ups again** (the app then says "Sign-ups are currently closed."): switch "Allow new users to sign up" OFF and save. Existing accounts keep working.
   - Free-tier note: strangers can create accounts, which uses a little of your free Supabase quota (the free tier allows 50,000 monthly active users and 500 MB of database; each vault is one small row). Check Authentication → Users now and then and delete spam accounts.
4. **Your own login:** create your account the same way (the app's **Create account** link), or add it yourself in
   **Authentication → Users → Add user → Create new user** (tick **Auto Confirm User**). This is your *account password*.
   (It is different from the vault passphrase you choose the first time you open the app.)
5. **Copy two values** for Vercel: **Project Settings → API** (or the **Connect** button at the top).
   - **Project URL**, looks like `https://abcdefghijkl.supabase.co`
   - **anon / public key** (a long text; newer projects call it the *publishable key*, which also works).
   - ⚠️ Never use the `service_role` or *secret* key. The build refuses it, but don't paste it anywhere.
   The anon key is *meant* to be public: the database rules (RLS from step 2) are what keep your row private,
   and the row is encrypted anyway.

## Part 2: Vercel (the website)

### Option A: with the website (easiest)
1. Put this folder in a private GitHub repository (or ask your assistant to).
2. <https://vercel.com> → **Add New → Project** → pick the repo.
3. Leave everything as it is (the build command `node build.js` and output folder `dist` come from `vercel.json`).
4. Open **Environment Variables** and add two:
   - `SUPABASE_URL` = the Project URL from Part 1
   - `SUPABASE_ANON_KEY` = the anon key from Part 1
5. **Deploy.** Open the address Vercel gives you (like `nodle-abc.vercel.app`).

### Option B: with the command line (what an assistant with a Vercel token does)
```bash
cd peoplemap-app
npx vercel link --yes --project nodle --token $VERCEL_TOKEN
printf '%s' "$SUPABASE_URL"      | npx vercel env add SUPABASE_URL      production --token $VERCEL_TOKEN
printf '%s' "$SUPABASE_ANON_KEY" | npx vercel env add SUPABASE_ANON_KEY production --token $VERCEL_TOKEN
npx vercel deploy --prod --token $VERCEL_TOKEN
```
(These variables are read at **build** time. If you change them later, redeploy.)

### Optional but good
- Supabase → **Authentication → URL Configuration → Site URL**: set it to your Vercel address.
- Add the site to your phone's home screen (browser menu → *Add to Home Screen*) so it behaves like an app.

---

## First time you open it
1. The opening animation plays (press any key or tap to skip).
2. Log in with the email + account password from step 4. Leave **Stay logged in on this device** ticked on your own devices;
   untick it on a shared computer.
3. **Create your vault passphrase.** This is the key that scrambles your data in your browser.
   - ⚠️ **It cannot be recovered. Not by Supabase, not by Vercel, not by whoever built this.**
     If you forget it, the data is gone for good. Write it in your password manager *and* on paper.
   - Use 4+ random words (e.g. `correct horse battery staple`, but your own).
4. Click **Save backup** (encrypted) once and keep the file somewhere safe. Free Supabase projects have no automatic backups.
5. Optional: Settings → **Security** → set a **PIN**, turn on **two-step sign-in**, change the auto-lock time.

On the first-run passphrase screen there is a **Load demo data** button: it starts your map with 19 *fake* people so you can see everything straight away (you still choose a passphrase). You can also load or clear the demo later in Settings → Data. Clear it before you add real people.

---

## What is protected, honestly

| Thing | Who can see it? |
|---|---|
| Names, notes, ratings, risk, everything about your contacts | **Only you.** It is encrypted in your browser (AES-256-GCM, key from your passphrase via PBKDF2-SHA256, 600,000 rounds) before it leaves. Supabase stores unreadable text. |
| Your vault passphrase | Never leaves the browser. Never stored (unless you set a PIN, see below). |
| Other people's data | Nobody else with an account can read your row (row-level security), and even if they could, it is encrypted with your passphrase. |
| That you have an account, when you last saved, roughly how big the data is, your IP address | Supabase and Vercel can see this (it is normal metadata). |
| The website code itself | Served by Vercel. Anyone who controls your Vercel/GitHub account could change the code to steal your passphrase. **Turn on two-step login for Vercel, GitHub and Supabase.** |

Other facts worth knowing:
- **PIN:** a PIN is only 4–6 digits, so it is a *convenience lock*, not strong encryption. It keeps the key on this device, wrapped by the PIN.
  After 5 wrong tries the app erases it. But if someone copies the site data off your device, they can guess PINs offline very fast.
  So: use a PIN only on devices that have their own screen lock and disk encryption. The passphrase is the real protection.
- **Auto-lock** (default 5 minutes idle, you can change it): wipes the data from the page and asks for the PIN/passphrase.
  Anything you typed in the last second or so that had not finished saving can be lost.
- **Two devices:** every save checks a version number. If another device saved first, you get a clear choice
  (keep mine / use theirs / download mine) instead of a silent overwrite.
- **Log out all devices** (Settings → Security) signs every session out. Sessions already open stay unlocked until they lock or refresh, so lock them too.
- **Supabase free tier:** projects **pause after about 7 days with no activity** (you can restart it in one click; nothing is lost).
  Just open the app once a week.
- **Changing the vault passphrase** is in Settings → Security. It re-encrypts everything and every other device must unlock again.

## Updating the bundled library
The Supabase browser library is saved inside the project (`src/vendor/supabase.js`, **supabase-js 2.118.0**,
SHA-256 `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`, 218,252 bytes) so the site never loads code from another server.
To check it: `shasum -a 256 src/vendor/supabase.js`.

## Checking it works before you rely on it
```bash
npm test                      # crypto, PIN, conflict, risk and importer tests (no internet, no accounts)
SUPABASE_URL=https://dummy.supabase.co SUPABASE_ANON_KEY=dummy node build.js && python3 tests/e2e.py   # full browser test with a fake Supabase
```
These use a fake Supabase. Things only a real project can prove are listed in `README.md` under "Needs a real Supabase".

## For an assistant doing this with tokens
You need: a **Supabase personal access token** (Account → Access Tokens) *or* the project's URL + anon key + a way to run `schema.sql`;
and a **Vercel token** (Account Settings → Tokens). With the Supabase token the whole of Part 1 can be done through the Management API
(create project, run `schema.sql` with `POST /v1/projects/{ref}/database/query`, leave `disable_signup: false` (sign-ups are open; set it to `true` to close them) with `PATCH /v1/projects/{ref}/config/auth`,
read the anon key from `GET /v1/projects/{ref}/api-keys`). Creating the login user needs the service-role key **once**, from the same API;
do not store it anywhere. Better: have Georgia choose her own account password in the dashboard (Authentication → Users → Add user).
