# SĀLFA — سالفة

**Every cup has a story. / كل فنجال وراه سالفة**

A private gahwa log. Record what you drank, where you were, who you were with,
how good it was, and the story worth keeping. Bilingual (English / العربية),
fully responsive, and private per user — enforced by the database, not the browser.

---

## Stack

No build step, no framework, no `node_modules`.

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Frontend  | Plain HTML + CSS + ES modules                                 |
| Backend   | Supabase (Postgres + Auth), loaded from CDN as an ES module   |
| Hosting   | Vercel (static, with a tiny build step for env vars)          |

```
index.html                 shell: header, main, footer, sheet, toaster
css/salfa.css              design tokens + every style (edit tokens to re-skin)
js/config.js               Supabase URL + key (git-ignored, generated)
js/config.example.js       template for the above
js/supabase.js             client creation
js/i18n.js                 all interface copy, EN + AR, RTL switching
js/auth.js                 sign up / log in / log out + friendly errors
js/logs.js                 read + insert gahwa logs, stats
js/app.js                  hash router, views, interactions
scripts/generate-config.mjs  writes js/config.js from env vars at deploy time
supabase/migrations/       the schema + RLS policies, as applied
```

---

## Run it locally

1. **Configure Supabase**

   ```bash
   cp js/config.example.js js/config.js
   ```

   Fill in your project URL and publishable key from the Supabase dashboard
   (Project Settings → API Keys). `js/config.js` is git-ignored.

2. **Serve the folder.** Any static server works; it must be served over HTTP,
   not opened as a `file://` path, because the app uses ES modules.

   ```bash
   python3 -m http.server 4173
   ```

   Then open <http://localhost:4173>.

---

## Supabase setup

**1. The table and its policies** — already applied to the `salfa` project. To
recreate from scratch, run `supabase/migrations/0001_create_gahwa_logs.sql` in
the SQL editor.

`public.gahwa_logs`

| Column        | Type          | Notes                                        |
| ------------- | ------------- | -------------------------------------------- |
| `id`          | `uuid`        | primary key, `gen_random_uuid()`             |
| `user_id`     | `uuid`        | defaults to `auth.uid()`, cascades on delete |
| `name`        | `text`        | required, 1–120 chars                        |
| `place`       | `text`        | optional                                     |
| `with_who`    | `text`        | optional                                     |
| `rating`      | `smallint`    | required, `between 1 and 5`                  |
| `is_favorite` | `boolean`     | defaults `false`                             |
| `notes`       | `text`        | optional, max 2000 chars                     |
| `created_at`  | `timestamptz` | defaults `now()`                             |

Row Level Security is **enabled**, with one policy per operation, all scoped to
`(select auth.uid()) = user_id`:

- `own logs are selectable` — SELECT
- `own logs are insertable` — INSERT (`with check`)
- `own logs are updatable` — UPDATE (`using` + `with check`)
- `own logs are deletable` — DELETE

The frontend never filters by `user_id` on reads. Postgres decides which rows
exist for a given token, so the browser cannot widen the query.

**2. Turn off email confirmation** (required for signup to log you straight in)

Dashboard → **Authentication** → **Sign In / Providers** → **Email** →
turn **Confirm email** off → Save.

Leave it on only if you want real confirmation emails; the app handles that
case too, showing "check your inbox" instead of opening the dashboard. Note the
built-in SMTP is rate-limited to a couple of messages per hour.

---

## Environment variables

| Variable            | Example                             |
| ------------------- | ----------------------------------- |
| `SUPABASE_URL`      | `https://<ref>.supabase.co`         |
| `SUPABASE_ANON_KEY` | `sb_publishable_…`                  |

Both are safe in the browser — the publishable key is designed for client-side
use and RLS is what protects the data. **Never** add a service-role key.

No secrets are committed: `js/config.js` is git-ignored, and on Vercel it is
generated at build time by `scripts/generate-config.mjs`.

---

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project**, import the repo.
3. Framework preset: **Other**. `vercel.json` already sets the build command
   and output directory — leave them as detected.
4. Add both environment variables above (Production + Preview).
5. Deploy.

If the build fails with "Missing environment variables", the variables were not
set — add them and redeploy.

---

## What to test

**Auth**
- Sign up with a name → lands on the dashboard, greeting uses your name
- Sign up with an email already in use → "There is already an account…"
- Log in with a wrong password → "That email and password don't match."
- Submit an empty form → per-field messages, nothing sent
- Reload while logged in → still logged in, same page
- Log out → back to the landing page; typing `#/dashboard` bounces to login

**Logging a cup**
- Save with only a name and rating → works
- Save with no name or no rating → inline errors, form stays put
- Save a full entry → success toast, card appears at the top, stats update
- Click a card → detail sheet with notes intact; Escape and ✕ both close it

**Privacy** (the important one)
- Create a second account, log a cup, then log back in as the first
- The second account's cup must not appear anywhere

**Bilingual**
- Switch to العربية → all interface text translates, layout flips to RTL,
  numbers and dates become Arabic-Indic
- Your own notes, place and names stay exactly as you typed them
- The choice survives a reload

**Responsive**
- Desktop / tablet / mobile
- On mobile the Add button sits in the thumb zone and the detail view opens as
  a bottom sheet, not a centred dialog

---

## Not built yet (ice box)

Editing, deleting, search and filtering, expanded insights, image uploads,
public sharing.
