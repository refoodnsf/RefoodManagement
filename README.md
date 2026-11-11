# Refood Management

Touch kiosks and a management site for a Refood centre.

| Address | What it is | Who uses it |
| --- | --- | --- |
| `/s1` | **System 1 — beneficiary kiosk** (Surface #1, touch) | Volunteers at the distribution desk |
| `/admin` | **System 3 — management** | Coordinators (Administrador / Gestor Beneficiários) |
| `/s2` | System 2 — volunteer kiosk | *not built yet* |

Stack: Next.js 16 (App Router) on Vercel (region `fra1`), Supabase Postgres + Auth (Frankfurt, free plan).

## How access works

- **Kiosks** don't log in. An administrator opens **Quiosques** in `/admin`, copies the pairing link
  and opens it once on the Surface. That stores a long-lived cookie; `/s1` and `/api/s1/*` refuse any
  browser without it. Rotate `KIOSK_TOKEN` in Vercel to revoke every kiosk.
- **Coordinators** sign in with email + password. Administrators create accounts in **Utilizadores**
  (a temporary password is shown once) and choose the profile:
  - *Administrador* — everything.
  - *Gestor Beneficiários* — only the beneficiary list.
- The database has Row Level Security on every table and no policies, so the public Supabase key
  can read nothing. Only the server talks to the database, with the secret key.

## Offline

System 1 keeps working if the Wi-Fi drops: visits are saved in the browser and sent when the
connection returns (each has a unique id, so a retry is never counted twice). The beneficiary list is
cached on the device. A small "Sem ligação" badge shows while offline.

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
| `CENTRE_NAME` | Optional | Shown as "Núcleo …" on the kiosk |

## Deploying

Pushing to `main` deploys to production on Vercel; other branches get preview URLs.
Run `npm run db:migrate` before pushing code that needs a new migration.

Requirements and design: see the requirements doc and the Claude Design canvas linked in the project notes.
