# Refood Management

Touch kiosks and a management site for a Refood centre.

| Address | What it is | Who uses it |
| --- | --- | --- |
| `/s1` | **System 1 — beneficiary kiosk** (Surface #1, touch) | Volunteers at the distribution desk |
| `/s2` | **System 2 — volunteer kiosk** (Surface #2, touch + camera) | Volunteers on shift |
| `/admin` | **System 3 — management** | Coordinators (Administrador / Gestor Beneficiários) |

Stack: Next.js 16 (App Router) on Vercel (region `fra1`), Supabase Postgres + Auth (Frankfurt, free plan).

## How access works

- **Kiosks** don't log in. An administrator opens **Quiosques** in `/admin`, copies the pairing link
  and opens it once on the Surface (one link per Surface: it ends in `next=s1` or `next=s2`). That
  stores a long-lived cookie; `/s1`, `/s2` and `/api/s1|s2/*` refuse any browser without it. Rotate `KIOSK_TOKEN` in Vercel to revoke every kiosk.
- **Coordinators** sign in with email + password. Administrators create accounts in **Utilizadores**
  (a temporary password is shown once) and choose the profile:
  - *Administrador* — everything.
  - *Gestor Beneficiários* — only the beneficiary list.
- The volunteer kiosk never downloads the volunteer list: it sends one typed number to
  `/api/s2/lookup` and gets back only that name.
- Images (kiosk photos, admin photos, task photos, event images) live in the private Supabase
  Storage bucket `media` and are served by `/media/...` only to a paired kiosk or a signed-in
  coordinator.
- The database has Row Level Security on every table and no policies, so the public Supabase key
  can read nothing. Only the server talks to the database, with the secret key.

## Offline

Both kiosks keep working if the Wi-Fi drops: records are saved in the browser and sent when the
connection returns. A small "Sem ligação" badge shows while offline.

- System 1: each visit has a unique id, so a retry is never counted twice. The beneficiary list is
  cached on the device.
- System 2: task ticks are replayed with their tap time and the latest tap wins; check-ins have a
  unique id and the database allows one per volunteer per day. Offline, the kiosk cannot show the
  volunteer's name ("Este é o teu número?"); an unknown number typed offline is dropped when it
  syncs. Photos need the connection (they are too big for the offline queue).

## System 2 rules in code

- Schedule: 1.º Turno before 20:00, 2.º Turno from 20:00 (Lisbon time). A manual choice falls back
  to automatic after 60 s without a touch.
- Task status is per Lisbon day (`task_completions`, one row per task per day). Deleting a task only
  sets `deleted_at`, so past completions stay in the analytics.
- Kiosk photos expire 5 days after they were taken: hidden from the kiosk at `expires_at`, and the
  daily Vercel cron `/api/cron/cleanup` (03:30 UTC) deletes the files. Admin photos never expire.

## Local development

```bash
vercel env pull        # writes .env.local with the Supabase keys and KIOSK_TOKEN
npm install
npm run db:migrate     # applies supabase/migrations/*.sql (idempotent)
npm run dev            # http://localhost:3000
```

Create the first administrator (prints a temporary password):

```bash
npm run create-admin -- name@example.pt "Nome"
```

Pair your local browser as a kiosk: `http://localhost:3000/kiosk/pair?token=<KIOSK_TOKEN from .env.local>`.

## Environment variables

| Name | Set by | Purpose |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*`, `POSTGRES_*` | Vercel Supabase integration | Database and auth |
| `KIOSK_TOKEN` | Us (random) | Pairs the kiosks |
| `CRON_SECRET` | Us (random) | Lets Vercel Cron call `/api/cron/cleanup` |
| `CENTRE_NAME` | Optional | Shown as "Núcleo …" on the kiosk |

## Deploying

Pushing to `main` deploys to production on Vercel; other branches get preview URLs.
Run `npm run db:migrate` before pushing code that needs a new migration.

Requirements and design: see the requirements doc and the Claude Design canvas linked in the project notes.
