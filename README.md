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
pnpm db:migrate           # tables, row-level security, and the dhara_app / dhara_admin roles
pnpm db:seed              # optional demo chamber with one person per role
pnpm dev                  # http://localhost:3000
```

Sign in with a mobile number. In development the SMS code prints in the `pnpm dev` console. The demo seed creates `01700000001` (owner), `…02` (associate), `…03` (munshi) and `…04` (staff). Owners are asked to turn on two-step verification with an authenticator app.

The admin portal shell is at `/admin` (development only until M3).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build, serve |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks |
| `pnpm i18n:check` | Fails if `bn.json` and `en.json` keys differ |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:perm` | Permission suite: every P-rule per role, and database isolation between chambers (needs PostgreSQL; database `dhara_test`) |
| `pnpm test:e2e` | Playwright journeys at 390px and 1280px, light and dark (database `dhara_e2e`; SMS goes to a file). Set `PLAYWRIGHT_CHROMIUM_PATH` to use an existing Chromium |
| `pnpm db:migrate` | Apply migrations and set the app and admin role passwords from `.env` |
| `pnpm db:migrate:dev` | Create a new migration while developing |
| `pnpm db:seed` | Demo data (local and staging only) |
