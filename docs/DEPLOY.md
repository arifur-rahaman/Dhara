# Deploying Pocket Chamber (first launch: Vercel + Supabase)

The product is called **Pocket Chamber**. The code, repository and database roles still use the working name `dhara`; that is internal and never shown to users.

This is the low-cost setup for the first chambers. Move to paid hosting when there are clients. Every service below is swappable later; the app only needs Postgres, S3-compatible storage, an email (later SMS) sender and a scheduler.

> **Check before you rely on this.** Plans, limits and terms change. Points I could not confirm are marked **(verify)**. Hosting location is still an open legal question (plan.md §12): choose a Supabase region only after that advice, or knowingly for a pilot.

## 1. Accounts you create

| Service | Used for | Notes |
|---|---|---|
| Supabase | Postgres database, file storage | Pick the region nearest Bangladesh, e.g. Singapore **(verify the region list)** |
| Vercel | The web app | The free Hobby plan is, as far as I know, for non-commercial use only; once chambers pay, move to Pro **(verify terms)** |
| Resend (or another email API) | Sign-in codes by email | Needs a domain you control for the sender, e.g. `noreply@techhunt.org` |
| A scheduler | Reminders and pushes every minute | e.g. cron-job.org (free) **(verify)**; Vercel Cron on Hobby may allow only daily jobs **(verify)** |

## 2. Supabase

1. **Create a project.** Save the database password.
2. **Turn off the Data API** (Project Settings → Data API, or API): Dhara never uses it.
   - As a second guard, migration `20261013130000_supabase_lockdown` removes every grant Supabase gives its `anon`, `authenticated` and `service_role` roles.
   - Never put the `service_role` key anywhere: it bypasses row-level security.
3. **Connection strings.** Supabase shows them under Connect:
   - **Migrations** (`DATABASE_MIGRATE_URL`): the direct connection or the *session* pooler, as the `postgres` user.
   - **App, admin and jobs roles** (`DATABASE_URL`, `DATABASE_ADMIN_URL`, `DATABASE_JOBS_URL`): the same host with the role names `dhara_app`, `dhara_admin` and `dhara_jobs`, each with its own long random password.
     - Through Supavisor the username is usually `role.projectref`, e.g. `dhara_app.abcd1234` **(verify in Supabase's docs)**.
     - Start with the *session* pooler. Try the *transaction* pooler (port 6543) only after testing: Dhara keeps its RLS settings inside transactions, which should work there, but I have not tested Prisma's driver through it **(verify)**.
4. **Create Dhara's roles once.** In the Supabase SQL editor, run `scripts/supabase-roles.sql`. It creates `dhara_app`, `dhara_admin` and `dhara_jobs` and lets `postgres` act for them, the same setup CI tests (`scripts/check-nonsuper-migrate.sh`).
   - If the editor refuses the last line, try `GRANT dhara_app, dhara_admin, dhara_jobs TO postgres;` instead **(verify on your Postgres version)**.
5. **Run the migrations once from your computer** (Node 24, pnpm):

   ```bash
   DATABASE_MIGRATE_URL='postgresql://postgres:...@.../postgres' \
   DATABASE_URL='postgresql://dhara_app:<password>@.../postgres' \
   DATABASE_ADMIN_URL='postgresql://dhara_admin:<password>@.../postgres' \
   DATABASE_JOBS_URL='postgresql://dhara_jobs:<password>@.../postgres' \
   pnpm db:migrate
   ```

   - This creates the tables and row-level security, gives the three roles their passwords, and loads the course text.
   - Supabase's `postgres` user is not a superuser. CI checks on every change that the migrations work for such an owner (`scripts/check-nonsuper-migrate.sh`, which also copies Supabase's default grants).
   - Run `pnpm db:migrate` again for every release that adds a migration, before deploying it.
6. **Storage:**
   - Create a **private** bucket, e.g. `dhara-files`.
   - Under Storage → S3 connection, create access keys.
   - Set:
     - `STORAGE_PROVIDER=s3`;
     - `S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3`;
     - `S3_REGION`: the project's region, e.g. `ap-southeast-1`;
     - `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
   - Phones upload straight to storage with a 5-minute signed link, so the bucket must allow that from your app's address (CORS). I have not tested Dhara's uploads against Supabase's S3 endpoint **(verify with one upload and one download before launch)**. Cloudflare R2 is a drop-in alternative.
7. **Backups:**
   - Check what your Supabase plan keeps and for how long **(verify)**.
   - `scripts/backup.sh` (encrypted with `age`) can also run from a trusted machine against `DATABASE_MIGRATE_URL`.
   - Test a restore into a new database before launch (`scripts/check-backup-restore.sh`).

## 3. Email (sign-in codes)

1. In Resend, add your domain (e.g. `techhunt.org`) and the DNS records it asks for, then wait until it shows as verified.
2. Set:
   - `OTP_CHANNEL=email`;
   - `EMAIL_PROVIDER=resend`;
   - `RESEND_API_KEY=...`;
   - `EMAIL_FROM='Pocket Chamber <noreply@techhunt.org>'`.
3. Set `SMS_PROVIDER=none`.

How it then works:
- People sign in with their mobile number. The code goes to their email; a new number is asked for an address once.
- Owners share invitation links from their own phone (WhatsApp, SMS or copy).
- Someone without email can join from the invitation link with a password.

When an SMS gateway is chosen, switch to `OTP_CHANNEL=sms` and the gateway's `SMS_PROVIDER`.

## 4. Vercel

1. Import the GitHub repository `arifur-rahaman/Dhara`. Framework: Next.js; install command `pnpm install`; build command `pnpm build`.
2. `vercel.json` pins functions to Singapore (`sin1`), next to the database. Change it if your Supabase region is elsewhere.
3. **Environment variables** (Production). Every name is in `.env.example`.

   | Variable | Value |
   |---|---|
   | `APP_URL` | `https://pocketchamber.techhunt.org` |
   | `ADMIN_URL` | `https://admin-pocketchamber.techhunt.org` (optional: leave it empty and the admin portal stays off in production) |
   | `ADMIN_IP_ALLOWLIST` | your office IPs, if you want the admin portal limited |
   | `DATABASE_URL`, `DATABASE_ADMIN_URL`, `DATABASE_JOBS_URL` | from step 2 (not the migration URL) |
   | `DATABASE_POOL_MAX` | `3` |
   | `SESSION_SECRET` | `openssl rand -base64 48` |
   | `FIELD_ENCRYPTION_KEYS`, `FIELD_ENCRYPTION_ACTIVE` | as in `.env.example`; keep a copy offline, because client contact cannot be read without them |
   | `STORAGE_PROVIDER`, `S3_*` | from step 2.6 |
   | `OTP_CHANNEL`, `EMAIL_*`, `RESEND_API_KEY`, `SMS_PROVIDER` | from step 3 |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`; subject `mailto:you@techhunt.org` |
   | `PDF_MODE` | `print` (Vercel has no Chromium; PDF links open the print page and the browser saves the PDF) |
   | `RUN_JOBS` | `0` (no always-on worker on Vercel; see step 5) |
   | `CRON_SECRET` | `openssl rand -base64 48` |
   | `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL_EXTRACT`, `AI_MODEL_DRAFT` | `anthropic`, your Anthropic API key, and a model name for each (`.env.example` uses `claude-opus-5-5`). Only needed for the AI features: order photos (F37, `AI_MODEL_EXTRACT`), drafting (F33) and document summaries (F38, both `AI_MODEL_DRAFT`). Photos and summaries also need each owner to turn on AI reading in Settings. Leave `AI_PROVIDER` unset otherwise; in production the test provider answers "unavailable" |

4. **Domains:**
   - In Vercel, add `pocketchamber.techhunt.org` (and `admin-pocketchamber.techhunt.org` if you set `ADMIN_URL`) to the project.
   - Add the CNAME records Vercel shows at your DNS provider.
   - The admin portal answers only on `ADMIN_URL`.

## 5. Scheduler (reminders and notice pushes)

Create a job that runs **every minute**:

```
GET https://pocketchamber.techhunt.org/api/jobs/tick
Authorization: Bearer <CRON_SECRET>
```

- A missed minute is caught up on the next call, and each reminder and push is claimed once, so a late or repeated call is safe.
- Without the right secret the address is a 404.
- With Vercel Pro you can use Vercel Cron instead. It sends the same header when `CRON_SECRET` is set **(verify)**.

## 6. Before the first chamber

- [ ] Sign up as an owner with a real email; turn on two-step verification.
- [ ] Invite a test member by link; join with email, and once with a password.
- [ ] Upload a photo and a PDF to a case; open both.
- [ ] Add a fee and a payment; open the receipt and save it as PDF from the print page.
- [ ] Turn on push on a phone; add a next date from another account; the push should arrive within about a minute.
- [ ] Create a platform admin (`scripts/admin-create.mjs` with the production URLs) and sign in on the admin domain.
- [ ] Replace the placeholder privacy notice with the reviewed text (plan.md §8).

## Known limits of this setup

- **Phone numbers are not proven while codes go by email.**
  - Someone could sign up with another person's number. That person would then need support to recover it.
  - Invitations are therefore accepted only with the link, never by phone match.
  - SMS sign-in fixes this.
- **PDFs come from the browser's "Save as PDF"** instead of the server. Layout depends a little on the browser. Server PDFs return on a host with Chromium (`PDF_MODE=chromium`).
- **Real push delivery, Supabase's S3 endpoint and the pooler** have not been tested from here. Use the checklist above.
