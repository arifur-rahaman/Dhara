# ধারা · Dhara

মামলা, তারিখ, ক্লায়েন্ট — সব এক ধারায়।

Chamber management web app (installable PWA) for lawyers in Bangladesh. English by default; one tap switches to Bangla.

- **What to build:** [`plan.md`](plan.md)
- **Rules:** [`CLAUDE.md`](CLAUDE.md)
- **How it's built:** [`TECH_GUIDE.md`](TECH_GUIDE.md)

## Run it

Requires Node.js 22+ (CI uses the version in `.nvmrc`) and pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev            # http://localhost:3000
```

There is no sign-in yet (that is M1). In development the login page has **Preview the app shell** buttons that open the navigation for each role. The admin portal shell is at `/admin` (development only for now).

Optional local services (Postgres, MinIO): `docker compose up postgres minio`. The full stack including the app: `docker compose up --build`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build, serve |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks |
| `pnpm i18n:check` | Fails if `bn.json` and `en.json` keys differ |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:perm` | Permission suite (starts in M1) |
| `pnpm test:e2e` | Playwright at 390px and 1280px, light and dark. Set `PLAYWRIGHT_CHROMIUM_PATH` to use an existing Chromium |
| `pnpm db:migrate` / `pnpm db:seed` | Placeholders until M1 |
