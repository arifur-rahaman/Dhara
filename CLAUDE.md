# CLAUDE.md — ধারা (Dhara)

Brand: **Dhara** in English mode, **ধারা** in Bangla mode, `dhara` for the repo and package name. Tagline: মামলা, তারিখ, ক্লায়েন্ট — সব এক ধারায়।

Chamber management web app (installable PWA) for Bangladeshi lawyers. English by default; one tap switches to Bangla.
Chamber roles: owner, associate, munshi, staff. Plus a separate platform admin portal.

- **What to build:** `plan.md` — features F1–F59, permission rules P1–P14, milestones M0–M9. Read the relevant section before every task.
- **How it's built:** `TECH_GUIDE.md` — stack, folder layout, database, auth, permissions, i18n, offline, security, testing, deployment. Read the matching section before you build something new.
- **How it looks:** `docs/design/*.dc.html` — 38 screens in Bangla mode, plus `MainEnglish.dc.html` for English (files ending `Dark` are the dark theme). They use a template format (`<x-dc>`, `{{...}}`, `<sc-for>`): copy layout, spacing, colours, radii and Bangla copy exactly; do not copy the template syntax.

## Stack

Next.js (App Router) + TypeScript strict · pnpm · Tailwind CSS with CSS-variable tokens · shadcn/ui (Radix) restyled to our tokens · PostgreSQL + Prisma + Row-Level Security · pg-boss for jobs · S3-compatible storage (MinIO in dev) · Web Push · IndexedDB outbox for offline · next-intl (en default, bn optional) · HTML→PDF with headless Chromium (Playwright) · Vitest + Playwright · Docker Compose.

## Commands (create these scripts in M0)

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` / `pnpm typecheck`
- `pnpm test` (Vitest) / `pnpm test:e2e` (Playwright) / `pnpm test:perm` (permission suite)
- `pnpm db:migrate` / `pnpm db:seed`

## Non-negotiable rules

1. **Client contact is owner-only (P1).** Phone, email, NID, address live in `client_contacts`, encrypted (AES-256-GCM), read only by owner-scoped server code. Never include them in DTOs, API responses, logs, search, filters, exports or AI prompts for any other role. Write a test for every new endpoint that asserts they are absent for non-owners.
2. **Associates message clients without seeing numbers (P7).** The server sends; the client only ever sees a button and a status.
3. **Platform admins never read client data.** Admin portal uses a separate DB role with no grants on client tables. Support access = owner-approved grant, 24 h expiry, fully logged, client contact still hidden.
4. **All permission logic in `src/server/authz/`.** One policy function per resource/action. UI hiding is cosmetic; the server decides. RLS on `chamber_id` for every tenant table, set per request.
5. **Audit log** for: client-contact views, exports, role/permission changes, invitations, support access, deletions.
6. **No PII in logs** (client contact, OTP, tokens). Scrub error reports.
7. **Stage 3 stays off.** Court-data fetching (F43–F52), case-law corpora (F53–F54) and F55–F58 ship only as interfaces + disabled flags until `docs/permissions/<feature-id>.md` exists. Never write scrapers, never bypass CAPTCHAs, logins or IP blocks. F59 is not planned.
8. **AI answers only from our verified library and the user's own documents.** Drop any citation that is not in the library. Redact client identity before every AI call. Drafts carry a DRAFT watermark. Model names come from env vars.
9. **Secrets only in env**; keep `.env.example` complete.

## Design system

Look: calm "ink and paper". One blue accent, amber for owner-only/restricted/dues, green for active/paid/verified.

```css
:root {
  --bg:#F6F4EF; --surface:#FFFFFF; --surface-2:#EFECE5;
  --text:#1B1D22; --muted:#575C66; --border:#E2DED5;
  --accent:#2F4FA3; --on-accent:#FFFFFF; --accent-soft:#E6ECFA;
  --lock-bg:#FBF0DC; --lock-text:#8A520A; --ok-bg:#E2F1E8; --ok:#1E6A44;
  --nav:#1B1D22; --nav-text:#F6F4EF; --nav-muted:#B9BDC4; --nav-active:#2C3038;
}
[data-theme="dark"] {
  --bg:#121417; --surface:#1B1E23; --surface-2:#252930;
  --text:#E8E6E1; --muted:#A7ACB5; --border:#2F343B;
  --accent:#8FA8F0; --on-accent:#0F1320; --accent-soft:#1F2842;
  --lock-bg:#2B2317; --lock-text:#E8B36A; --ok-bg:#16271F; --ok:#7FD0A6;
  --nav:#0C0E11; --nav-text:#E8E6E1; --nav-muted:#9BA1AB; --nav-active:#1C2027;
}
/* "System" theme: same dark values under @media (prefers-color-scheme: dark) when no data-theme="light" is set */
```

- **Theme:** Light / Dark / System (default System), stored per user. PDFs, receipts and printouts are always light.
- **Fonts:** `Tiro Bangla` for page titles only; `Hind Siliguri` 400/500/600/700 for everything else; fallback `Noto Sans Bengali`, sans-serif. Load with `next/font/google`. Both include Latin letters; check English titles look right and fall back to a serif if not.
- **Type:** page title 30–32px (Tiro Bangla, weight 400); section title 15–16px/600; body 15–16px; captions 12–13px. Bangla paragraphs line-height 1.6–1.75.
- **Shape and space:** inputs/buttons radius 10–12px, cards 16px, pills 999px. Screen padding 20px mobile, 40px web. Gaps 8/12/14/16/24.
- **Touch targets ≥ 44px.** Mobile bottom tab bar 76px (owner: Today, Cases, Clients, Accounts, More — Bangla: আজ, কেস, ক্লায়েন্ট, হিসাব, আরও). Web sidebar 248px.
- **Text contrast ≥ 4.5:1.** Never tell states apart by colour alone; add a label or icon.
- **Icons:** inline stroke SVG, 1.8px stroke. **No emoji** anywhere in the UI.
- **Numbers:** English digits in English mode. In Bangla mode, Bangla digits by default (`Intl` with `bn-BD`) and the user can switch. Case numbers are shown as entered. Dates and times in `Asia/Dhaka`.
- **Copy:** plain words, active verbs. English mode: natural English ("Save", "Send OTP"). Bangla mode: the words people actually say — common English words in Bangla script for app terms (টিম, মেম্বার, রোল, পারমিশন, সেভ করুন, সার্চ, ড্রাফট, কেস, হিয়ারিং, অর্ডার), but legal terms stay Bangla (আরজি, ওকালতনামা, জামিন, বাদী/বিবাদী, তামাদি, এখতিয়ার, মুহুরি, তারিখ) and official case and court names stay exactly as written. Full table: `plan.md` section 14. An action keeps the same name through the flow. Errors say what happened and how to fix it. Empty screens tell the user what to do next.
- Keyboard focus always visible; respect reduced motion; no decorative animation.

## Code conventions

- Validate every input with zod at the server boundary.
- Server-only modules for `authz`, crypto and providers (`import 'server-only'`).
- Integrations behind interfaces: `SmsProvider`, `WhatsAppProvider`, `PaymentProvider`, `AiProvider`, `SpeechToTextProvider`, `CourtDataSource`, `StorageProvider`. Dev implementations log to the console.
- Folder sketch: `src/app/(app)/…` chamber app · `src/app/(admin)/…` admin portal · `src/server/{authz,db,crypto,jobs,providers}` · `src/features/<module>/…` · `src/i18n/bn.json`, `en.json`.
- All user-facing strings go through next-intl. `en.json` is the source; `bn.json` follows `plan.md` section 14 and the Bangla copy in the design files.
- Prefer well-known, maintained libraries. Before adding a dependency, say why.

## Workflow

1. Work milestone by milestone from `plan.md`. Before coding, list the tasks you will do for the current milestone.
2. Small commits with feature IDs, e.g. `feat(F18): munshi adds next date`.
3. Every change to permissions or data access comes with tests in the permission suite; `pnpm test:perm` must pass.
4. Check new screens at 390px and 1280px, in light and dark, against the matching design file.
5. Tick the checkbox in `plan.md` when a feature or milestone is done.
6. Ask before adding anything that is not in `plan.md`, and before changing any rule in this file.

## Domain words

মুহুরি = clerk · ওকালতনামা = vakalatnama · আরজি = plaint · কার্যতালিকা/কজলিস্ট = cause list · ক্রমিক/আইটেম = serial/item no. · পরের তারিখ = next hearing date · আদেশ = court order · বাদী/বিবাদী = plaintiff/defendant. Full glossary: `plan.md` section 13.
