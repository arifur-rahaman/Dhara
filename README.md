# ধারা · Dhara

মামলা, তারিখ, ক্লায়েন্ট — সব এক ধারায়।

Chamber management web app (installable PWA) for lawyers in Bangladesh. English by default; one tap switches to Bangla.

- **What to build:** [`plan.md`](plan.md)
- **Rules:** [`CLAUDE.md`](CLAUDE.md)
- **How it's built:** [`TECH_GUIDE.md`](TECH_GUIDE.md)

## Run it

Requires Node.js 22+ (CI uses the version in `.nvmrc`) and pnpm.

Requires PostgreSQL (16 or newer). With Docker: `docker compose up -d postgres minio`.

```bash
pnpm install
cp .env.example .env      # then fill SESSION_SECRET and FIELD_ENCRYPTION_KEYS (commands are in the file)
pnpm db:migrate           # tables, row-level security, the database roles, and course content
pnpm db:seed              # optional demo chamber with one person per role
pnpm dev                  # http://localhost:3000
```

Sign in with a mobile number. In development the SMS code prints in the `pnpm dev` console. The demo seed creates `01700000001` (owner), `…02` (associate), `…03` (munshi) and `…04` (staff). Owners are asked to turn on two-step verification with an authenticator app.

The platform admin portal is at `/admin` in development. Create an admin with
`node --env-file=.env scripts/admin-create.mjs --phone 01900000001 --name "Your Name" --role super_admin`; it prints a password and an authenticator QR code once. Each admin sign-in needs phone, password and a fresh authenticator code. In production the portal answers only on `ADMIN_URL` (its own host) and from `ADMIN_IP_ALLOWLIST`.

## Background jobs, offline and backups

- **Reminders (F5):** run one instance with `RUN_JOBS=1` (it needs `DATABASE_JOBS_URL` and the VAPID keys). It sends the night and morning reminders at each person's chosen Asia/Dhaka time.
- **Offline (F21):** the service worker serves a saved day view when there is no internet; changes made offline sync once when the connection returns. The journey is tested on a production build: `pnpm build && pnpm test:e2e:prod`.
- **Backups (F16):** schedule `scripts/backup.sh` nightly (encrypted with `age` to a public key; keep the private key off the server and sync `BACKUP_DIR` off-site). With S3 storage, also turn on bucket versioning and replication. To restore, create nothing by hand: `RESTORE_ADMIN_URL=... BACKUP_AGE_IDENTITY=backup.key scripts/restore.sh <file> <new_db>`, then `scripts/db-roles.mjs` against the new database. `scripts/check-backup-restore.sh` runs the whole round trip and compares every table; CI runs it on each change, and plan.md asks for a monthly drill in staging.

## Courses and import

- **Courses (F24, F25):** the course text lives in `content/courses.json` and is loaded by `scripts/load-courses.mjs` (part of `pnpm db:migrate`). Add a module's video by setting its `videoUrl` (https; YouTube links play through youtube-nocookie.com) and running the loader again. Progress is kept by module id, so keep ids stable.
- **Import (F20):** the Excel or CSV file is read in the browser; only the cell text of the mapped columns is sent. Client contact is never imported (P1); the owner adds it on the client's page with consent.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build, serve |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks |
| `pnpm i18n:check` | Fails if `bn.json` and `en.json` keys differ, a value is empty, or a key contains a dot |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:perm` | Permission suite: every P-rule per role, and database isolation between chambers (needs PostgreSQL; database `dhara_test`) |
| `pnpm test:e2e` | Playwright journeys at 390px and 1280px, light and dark (database `dhara_e2e`; SMS goes to a file). Set `PLAYWRIGHT_CHROMIUM_PATH` to use an existing Chromium |
| `pnpm db:migrate` | Apply migrations, set the app, admin and jobs role passwords from `.env`, and load `content/courses.json` |
| `pnpm db:migrate:dev` | Create a new migration while developing |
| `pnpm db:seed` | Demo data (local and staging only) |
