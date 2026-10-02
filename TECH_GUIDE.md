# TECH_GUIDE.md — ধারা (Dhara) technical guideline

This file says **how** Dhara is built, in detail. `CLAUDE.md` has the short, non-negotiable rules; `plan.md` says **what** to build (features F1–F59, permissions P1–P14, milestones M0–M9). When the three disagree: `CLAUDE.md` rules win, then `plan.md`, then this file — and ask.

Library names below are recommendations. Before adding one, check that it is maintained and works with the Next.js version in the repo. Numbers marked **target** are goals, not guarantees.

---

## 1. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict: true` | Catch mistakes early; one language front and back |
| Framework | Next.js (App Router, current stable) | Server Components for fast pages on cheap phones; Server Actions for forms |
| Runtime | Node.js (current LTS) | Stable, widely supported |
| Package manager | pnpm | Fast, strict dependency tree |
| Database | PostgreSQL (current stable) + Row-Level Security | One reliable store for data, jobs and (later) vectors |
| ORM | Prisma (+ raw SQL for RLS and reports) | Typed queries, migrations |
| Jobs / queues | pg-boss | Runs on Postgres, so no Redis to operate |
| File storage | S3-compatible (MinIO in development) | Portable between hosts |
| Auth | Own implementation: phone OTP + password (Argon2id) + TOTP, database sessions | Bangladesh phone-first login; full control over roles |
| UI | Tailwind CSS on CSS-variable tokens, shadcn/ui (Radix) primitives, lucide-react icons at 1.8 stroke | Accessible primitives, our own look |
| Theme | next-themes with `data-theme` (Light / Dark / System) | Standard, no flash on load |
| Forms | React Hook Form + zod | Same schema on client and server |
| i18n | next-intl (English default, Bangla) | ICU messages, locale formatting |
| PWA / offline | A maintained service-worker library for Next.js (e.g. Serwist), IndexedDB via Dexie | Installable app, offline Today list, outbox |
| Push | Web Push with VAPID (`web-push`) | Night and morning reminders |
| PDF | HTML rendered to PDF by headless Chromium (Playwright) | Correct Bangla conjuncts |
| Excel import | SheetJS or exceljs | Read old diaries in XLSX/CSV |
| Logging | pino with redaction | Structured logs without PII |
| Tests | Vitest, Playwright, axe | Unit, end-to-end, accessibility |
| CI | GitHub Actions | Lint, typecheck, tests on every push |
| Deploy | Docker + Docker Compose behind Caddy or Nginx | Easy to move between providers |
| AI (Stage 2) | Anthropic API; pgvector for retrieval; an embeddings provider (Anthropic's docs point to Voyage AI — check current docs) | Answers only from our library |

---

## 2. Repository layout

```
dhara/
├─ CLAUDE.md · plan.md · TECH_GUIDE.md
├─ docs/
│  ├─ design/            # 38 .dc.html screens + canvas.json (reference only)
│  └─ permissions/       # <feature-id>.md notes that unlock Stage 3 flags
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ sql/               # RLS policies, DB roles, report views
├─ src/
│  ├─ app/
│  │  ├─ (app)/          # chamber app: today, cases, clients, accounts, team, settings
│  │  ├─ (admin)/        # platform admin portal (separate subdomain)
│  │  ├─ (auth)/         # login, OTP, invite accept, onboarding
│  │  └─ api/            # webhooks and the few JSON endpoints
│  ├─ features/<module>/ # UI + server actions per module (cases, clients, …)
│  ├─ server/
│  │  ├─ authz/          # all permission policies (server-only)
│  │  ├─ db/             # prisma client, withTenant(), RLS helpers
│  │  ├─ crypto/         # field encryption (server-only)
│  │  ├─ audit/          # audit log writer
│  │  ├─ jobs/           # pg-boss workers and schedules
│  │  └─ providers/      # sms, whatsapp, payment, ai, storage, court-data adapters
│  ├─ i18n/              # en.json (source), bn.json, formatting helpers
│  ├─ styles/            # tokens.css, globals.css
│  └─ lib/               # small shared utilities
├─ tests/ (unit, perm, e2e, fixtures)
├─ docker/ · docker-compose.yml
└─ .env.example
```

---

## 3. Configuration and secrets

- Every variable is listed in `.env.example` with a comment. Validate all of them with zod at startup; the app refuses to start if one is missing or malformed.
- Never commit secrets. Never print them. Never send them to the browser (only `NEXT_PUBLIC_*` values reach the client, so keep that list tiny).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | App role (RLS applies) |
| `DATABASE_ADMIN_URL` | Admin-portal role (no access to client tables) |
| `DATABASE_MIGRATE_URL` | Migration role (used only by CI/deploy) |
| `APP_URL`, `ADMIN_URL` | Chamber app and admin portal origins |
| `SESSION_SECRET` | Session signing |
| `FIELD_ENCRYPTION_KEYS` | JSON map of key versions → base64 32-byte keys, e.g. `{"v1":"…"}` |
| `FIELD_ENCRYPTION_ACTIVE` | Key version used for new writes |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` | SMS adapter (`console` in dev) |
| `WHATSAPP_*` | WhatsApp Business Platform (Stage 2) |
| `PAYMENT_*` | Payment adapter (Stage 2) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | File storage |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `ANTHROPIC_API_KEY`, `AI_MODEL_DRAFT`, `AI_MODEL_EXTRACT` | AI (Stage 2); model names never hard-coded |
| `ADMIN_IP_ALLOWLIST` | Admin portal allowlist |

---

## 4. Database guidelines

- **Names:** tables `snake_case` plural (`cases`, `hearings`); columns `snake_case`.
- **IDs:** UUIDs (v7, generated in the app) so IDs sort by time and don't reveal counts.
- **Time:** store `timestamptz` in UTC; show in `Asia/Dhaka`. Hearing dates without a time use the `date` type.
- **Money:** integer **poisha** (1 taka = 100 poisha). Never floats.
- **Soft delete** (`deleted_at`) for cases, clients, documents; hard delete only through an owner-confirmed, audited action.
- **Every tenant table** has `chamber_id` with an index, and RLS enabled and **forced** (table owners bypass RLS unless it is forced).
- **Migrations:** Prisma migrate; never edit a migration that has run anywhere; RLS policies live in `prisma/sql` and are applied by a migration.

**RLS pattern**

```sql
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cases
  USING (chamber_id = current_setting('app.chamber_id', true)::uuid)
  WITH CHECK (chamber_id = current_setting('app.chamber_id', true)::uuid);
```

```ts
// src/server/db/tenant.ts  (server-only)
export async function withTenant<T>(chamberId: string, fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.chamber_id', ${chamberId}, true)`;
    return fn(tx);
  });
}
```

- The app connects with a role that is **not** a superuser and **not** the table owner.
- The admin portal connects with a separate role that has **no grants** on `clients`, `client_contacts`, `documents`, `fees`, `payments`, `hearings` content columns. Admin screens read from views that expose counts only.

---

## 5. Authentication

- **Phone format:** store E.164 (`+8801XXXXXXXXX`); accept local `01XXXXXXXXX` input and normalise.
- **OTP:** 6 digits, valid 5 minutes, stored only as a hash, max 5 attempts, rate-limited per phone and per IP (a Postgres-backed limiter such as rate-limiter-flexible).
- **Password:** optional, Argon2id; never logged; breached-password check is a nice-to-have.
- **TOTP 2FA:** required for owners after onboarding and for every platform admin (e.g. otplib); recovery codes shown once.
- **Sessions:** stored in the database; cookie `HttpOnly; Secure; SameSite=Lax`; rotate on login and role change; "log out other devices" in Settings.
- **Invitations:** owner creates → SMS link with a single-use token (hashed in DB, 7-day expiry) → OTP login → membership becomes active with the role the owner chose.
- **Admin portal:** separate subdomain, separate session cookie, IP allowlist, TOTP every login.

---

## 6. Authorisation (roles and permissions)

All checks live in `src/server/authz/`. UI hiding is only a convenience.

```ts
export type Role = 'owner' | 'associate' | 'munshi' | 'staff';
export type Ctx = { userId: string; chamberId: string; role: Role; caseScope: 'all' | 'assigned'; canSeeFees: boolean };

export const can = {
  viewClientContact: (c: Ctx) => c.role === 'owner',                          // P1 — fixed
  viewClientName:    (c: Ctx) => c.role !== 'staff',                          // P2
  viewCase:          (c: Ctx, k: { assigneeId: string | null }) =>
    c.role === 'owner' || c.role === 'munshi' ||
    (c.role === 'associate' && (c.caseScope === 'all' || k.assigneeId === c.userId)), // P3
  addHearing:        (c: Ctx, k: { assigneeId: string | null }) =>
    c.role !== 'staff' && can.viewCase(c, k),                                  // P4
  viewFees:          (c: Ctx) => c.role === 'owner' || (c.role === 'associate' && c.canSeeFees), // P9
  manageTeam:        (c: Ctx) => c.role === 'owner',                           // P10 — fixed
};
```

- **Field level:** every response goes through a DTO mapper per role. Client contact is fetched and decrypted only in `src/server/features/clients/contact.ts`, only when `can.viewClientContact`, and every read writes an audit entry.

```ts
export function toClientDTO(row: ClientRow, ctx: Ctx, contact?: Contact) {
  return {
    id: row.id,
    name: can.viewClientName(ctx) ? row.displayName : undefined,
    contact: can.viewClientContact(ctx) ? contact : undefined, // never for non-owners
  };
}
```

- **Search:** non-owners get no search, filter or sort on phone, email, NID or address — the query builder rejects those fields for them.
- **Staff** receive only: case number, court, serial, and their tasks.
- **Tests:** each P-rule has a test per role in `tests/perm/`; they assert both the decision and the absence of forbidden fields in JSON.

---

## 7. Encryption

- Client contact fields (phone, email, NID, address) use AES-256-GCM with a random 12-byte IV per value.
- Store as `v1:<iv>:<ciphertext>:<tag>` (base64) so keys can rotate: new writes use `FIELD_ENCRYPTION_ACTIVE`; a background job re-encrypts old rows.
- Keep a separate keyed hash (HMAC) of the normalised phone only if the owner needs duplicate detection; never expose it.
- Database and backups are also encrypted at rest by the host.

---

## 8. Server conventions

- **Mutations:** Server Actions named with verbs (`addHearing`, `inviteMember`). Each one: parse input with zod → load `Ctx` → check `can.*` → run inside `withTenant` → write audit if needed → return `Result<T, AppError>`.
- **Errors:** typed `AppError` codes mapped to i18n messages that say what happened and how to fix it. Never show stack traces.
- **Reads:** Server Components call query functions in `features/<module>/queries.ts`; the same authz and DTO rules apply.
- **Route handlers** only for webhooks (payments, WhatsApp, SMS delivery), file upload URLs, and the offline sync endpoint.
- **Webhooks:** verify signatures; store the event ID and ignore repeats (idempotent).
- **Pagination:** cursor-based (`created_at, id`).
- **CSRF:** keep Next.js's built-in origin check for Server Actions; never change state from a GET.

---

## 9. Frontend guidelines

- Server Components by default; Client Components only where interaction needs them.
- Colours only through tokens (`var(--accent)`, Tailwind classes mapped to tokens). No raw hex values in components.
- Mobile first. Below 768px: bottom tab bar per role; from 768px: sidebar layout (owner web, as in `TeamRoles.dc.html`).
- Touch targets ≥ 44px; visible focus ring; `prefers-reduced-motion` respected.
- Tables on phones become stacked cards; on web they can be tables with sticky headers.
- Loading states are skeletons with the final layout; empty states follow `EmptyState.dc.html`.
- **Target:** the Today screen is usable within about two seconds on a mid-range Android phone over 4G.

---

## 10. Internationalisation

- `src/i18n/en.json` is the source of truth; `bn.json` must contain every key (CI fails on missing keys).
- Keys by screen and element: `cases.list.title`, `hearing.nextDate.save`.
- No string concatenation; use ICU placeholders and plurals (`{count, plural, one {# hearing} other {# hearings}}`).
- One formatting helper for numbers and dates: English digits in English mode; in Bangla mode `Intl` with `bn-BD` (Bangla digits) unless the user chose English digits. Time zone always `Asia/Dhaka`.
- Case numbers, court names and party names are data: display them exactly as entered.
- Bangla wording follows `plan.md` section 14.
- The language choice is saved per user and applied on the login screen too (cookie before login, profile after).

---

## 11. PWA and offline

- Web app manifest with name "Dhara", Bangla short name "ধারা", theme colours from the tokens.
- **Caching:** app shell cached; GET data for Today, tomorrow and the last opened cases uses stale-while-revalidate; nothing with client contact is cached for non-owners (they never receive it anyway).
- **IndexedDB (Dexie):** tables `today`, `cases`, `tasks`, `outbox`.
- **Outbox:** each offline write gets a client-generated idempotency key; a sync loop retries with backoff; the server ignores repeats. Conflicts: keep both entries in the case timeline and tell the user.
- The offline banner and pending-changes card follow `Offline.dc.html`.
- On iPhone, web push generally works only after the app is added to the Home Screen — show a short tip.

---

## 12. Reminders and background jobs

| Queue | When | What |
|---|---|---|
| `reminder.night` | 20:00 Asia/Dhaka (user-adjustable) | Tomorrow's hearings |
| `reminder.morning` | 07:00 Asia/Dhaka (user-adjustable) | Today's hearings and tasks |
| `client.reminder` | 7 and 2 days before (Stage 2) | Client SMS/WhatsApp |
| `support.expire` | every 5 minutes | End expired support grants |
| `crypto.rotate` | on demand | Re-encrypt with the new key |
| `backup.daily` | nightly | Encrypted DB dump + storage sync |

- **Push text never includes client names or case details** (it shows on lock screens): "কাল ৩টি হিয়ারিং" / "3 hearings tomorrow", and the details appear after opening the app.

---

## 13. Files and documents

- Object keys: `chambers/{chamberId}/cases/{caseId}/{uuid}.{ext}`; original file names stored in the DB, not in keys.
- Uploads go straight to storage with short-lived signed URLs (about 5 minutes); downloads too, issued only after `can.*` checks, including the confidential rule (P6).
- Allowed types: PDF, JPEG, PNG, HEIC (convert to JPEG); size limit per file; photos compressed on the device before upload.
- Optional virus scan (e.g. ClamAV) before a file becomes visible.

---

## 14. PDF output

- Render HTML templates with Playwright's Chromium and `page.pdf()`, always with the light theme.
- Embed Hind Siliguri / Tiro Bangla (or Noto Sans Bengali) so conjuncts render correctly.
- Test every template with conjunct-heavy text (যুক্তাক্ষর, ক্ষ্ম, স্ত্র) and compare screenshots in CI.
- Receipts get sequential numbers per chamber, assigned inside a transaction.

---

## 15. Integration adapters

```ts
export interface SmsProvider { send(to: E164, text: string, ref: string): Promise<{ id: string }> }
export interface WhatsAppProvider { sendTemplate(to: E164, template: string, vars: string[], ref: string): Promise<{ id: string }> }
export interface PaymentProvider { createLink(p: { amountPoisha: number; ref: string }): Promise<{ url: string }>; verifyWebhook(req: Request): Promise<PaymentEvent> }
export interface CourtDataSource { lookup(caseRef: CaseRef): Promise<CourtResult | null> } // Stage 3; default ManualSource returns null
```

- Dev implementations log to the console. Real providers are chosen by env.
- **SMS:** a Bangladeshi gateway; the vendor usually handles sender-ID approval. Messages to clients are sent by the server; the requesting user never receives the number.
- **WhatsApp:** Business Platform with approved templates and recorded client opt-in.
- **Payments:** bKash/Nagad directly or via an aggregator; reconcile only from verified webhooks.
- **Google Calendar (F8):** minimal scopes, one-way push, behind a flag until Google's verification is done.

---

## 16. AI (Stage 2)

- **Library first:** ingest law sections (and later licensed judgments) as chunks with IDs, source URL and `verified_at`; embed into pgvector.
- **Flow:** redact the user's input (names, phone numbers, NID, addresses → placeholders) → retrieve top chunks → call the model with only those chunks → run a **citation check** that removes any reference not found in the retrieved IDs → show the answer with sources and the DRAFT mark.
- Prompts and outputs are stored per chamber for the lawyer to review; never shared across chambers.
- Per-chamber rate limits and monthly usage caps.
- Keep a test set of real questions with expected sources, plus adversarial prompts ("cite a DLR case about…") that must return "not found" rather than an invented citation.

---

## 17. Stage 3 (court data) — built last, only with permission

- Only the `CourtDataSource` interface, `ManualSource`, feature flags and UI placeholders exist until `docs/permissions/<feature-id>.md` is present.
- When allowed: cache results, rate-limit, send an identifiable user agent, respect robots rules, and never bypass CAPTCHAs, logins or IP blocks. Store `source_url` and `fetched_at` with every imported hearing.

---

## 18. Security checklist

- HTTPS everywhere; HSTS; a Content-Security-Policy without `unsafe-inline` scripts; `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`).
- React escapes output; if any HTML is rendered from users or AI, sanitise it.
- No server-side fetching of user-supplied URLs (prevents SSRF).
- Uploads validated by content type and size; served from storage, never from the app origin.
- Dependency audit and secret scanning in CI.
- Audit log is append-only (no update/delete grants for the app role).
- Admin portal: separate origin, IP allowlist, TOTP, full audit.
- Backups encrypted; a restore is tested every month in staging.

---

## 19. Logging and monitoring

- pino JSON logs with redaction for `phone`, `email`, `nid`, `address`, `otp`, `token`, `password` and request bodies of sensitive routes.
- Error tracking with PII scrubbing (hosted or self-hosted).
- Uptime checks for app, admin portal and job worker; alerts on failed jobs and failed backups.

---

## 20. Testing and CI

- **CI gates (must pass):** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:perm`, `pnpm test:e2e` (smoke set), missing-translation check.
- **Fixtures:** two chambers with every role, so isolation and permission tests are real.
- **E2E:** one journey per role at 390px and 1280px, light and dark, English and Bangla.
- **Accessibility:** axe on every page in the smoke set.
- **Special cases:** Bangla PDF rendering, offline outbox sync, support-grant expiry, key rotation.

---

## 21. Git workflow and working with Claude Code

- Short branches: `feat/F18-munshi-next-date`, `fix/P1-contact-leak`.
- Commits and PR titles carry feature or permission IDs.
- PR checklist: feature ID, screenshots (light and dark, English and Bangla), tests added, `plan.md` checkbox ticked.
- With Claude Code: one milestone per session; ask it to list the tasks before coding; ask for the permission tests before the feature code; review every change to `src/server/authz`, `src/server/crypto` and `prisma/sql` yourself.

---

## 22. Deployment

- `docker-compose.yml` services: `app` (Next.js), `worker` (pg-boss jobs), `pdf` (Playwright renderer, internal only), `postgres`, `minio` (dev/staging), `proxy` (Caddy or Nginx with TLS).
- Environments: local, staging, production; production data never copied to staging without anonymising.
- Deploy runs migrations with `DATABASE_MIGRATE_URL`, then starts the new app and worker.
- Hosting location is decided after the legal opinion on the data protection law (`plan.md` section 12); nothing in the stack ties Dhara to one provider.
