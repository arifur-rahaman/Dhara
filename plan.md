# plan.md — ধারা (Dhara) build plan

> Name: **ধারা** (Latin: Dhara). Tagline: মামলা, তারিখ, ক্লায়েন্ট — সব এক ধারায়।
> A chamber management web app (installable PWA) for Bangladeshi lawyers. English by default; one tap switches to Bangla.
> This file says **what** to build. `CLAUDE.md` says **how** to build it.

---

## 0. How to use this file

- Build one milestone at a time (section 9). Start the next one only after the current milestone's acceptance checks pass.
- Every feature has an ID (**F1–F59**) and every permission rule has an ID (**P1–P14**). Use the IDs in commit messages, PR titles and test names, e.g. `feat(F26): send next-date SMS without exposing number`.
- Tick the checkboxes in this file as work is finished.
- Items marked **[PERMISSION]** stay behind a feature flag that is OFF. Turn one on only after the project owner adds a note in `docs/permissions/<feature-id>.md` saying the permission, licence or legal opinion exists.
- If something is unclear or missing, ask. Do not invent product decisions.

---

## 1. The product in one paragraph

Lawyers in Bangladesh keep cases, hearing dates, fees and client details in paper diaries. This app puts all of that in one simple app (English by default, Bangla in one tap) that works on a phone in the court corridor and on a computer in the chamber. The chamber owner invites associates, a munshi and office staff, and each person sees only what their role allows. Client contact details stay with the owner alone. Later stages add client SMS/WhatsApp, online payments, AI drafting, law explanations and (only with official permission) automatic court cause-list data.

---

## 2. Principles (non-negotiable)

1. **Client contact is owner-only.** Phone, email, NID and address of a client are visible only to the chamber owner. Enforced on the server and in the database, not just hidden in the UI.
2. **Platform admins cannot see client data.** Our own super admins manage accounts and subscriptions only. Support access needs the owner's approval, lasts 24 hours, and still hides client contact.
3. **Everything sensitive is logged.** Viewing client contact, exports, role changes, support access and deletions go to an audit log the owner can read.
4. **AI never answers from memory.** AI features only use our verified library and the user's own documents. No citation is shown unless it exists in the library. Drafts are marked DRAFT; the lawyer decides.
5. **No court-site automation without written permission.** Until then, the app only links to official pages (F7).
6. **Simple and mobile first; English by default, Bangla in one tap.** Lawyers use it standing, one-handed, in a hurry. Big touch targets, few steps, plain words. Bangla mode uses the words people actually say (section 14).
7. **Light, dark and system theme on every screen.** Printed or PDF output is always light.
8. **Works with bad internet.** Today's list and recent cases are readable offline; changes queue and sync later.
9. **Privacy law.** Bangladesh's Personal Data Protection Ordinance 2025 requires explicit consent before collecting personal data, and (per reporting on the approved draft) restricts moving sensitive data such as criminal records abroad. Hosting location and consent flows must be confirmed with a lawyer (see section 12).

---

## 3. Roles and permissions

| Role | Who | Where they log in |
|---|---|---|
| Super admin | Our team | Separate admin portal on a separate subdomain, 2FA mandatory |
| Support | Our support staff | Same admin portal, only through an owner-approved, time-limited grant |
| Owner | Chamber owner / main lawyer | The app (web + PWA) |
| Associate | Associate lawyer | The app |
| Munshi | Clerk | The app |
| Staff | Office staff or peon | The app |

- One login screen for all chamber roles (mobile number + OTP, or password). **Nobody chooses a role at login**; the role comes from the membership the owner created.
- A person can belong to more than one chamber (one membership per chamber, with a chamber switcher).

### 3.1 Permission matrix (chamber roles)

| ID | Permission | Owner | Associate | Munshi | Staff |
|---|---|---|---|---|---|
| P1 | Client contact: phone, email, NID, address | Yes | **Never** (locked) | **Never** (locked) | **Never** (locked) |
| P2 | Client name | Yes | Yes | Yes | No |
| P3 | Cases and hearing dates | All | Assigned only (owner may allow all) | All | Today's list only: case no., court, serial |
| P4 | Add next date, add order photo | Yes | Yes (assigned cases) | Yes | No |
| P5 | Documents | All | Assigned cases | Orders only | No |
| P6 | Confidential documents | Yes | Own uploads only | No | No |
| P7 | Message a client through the app (number stays hidden) | Yes | Yes (assigned cases) | No | No |
| P8 | AI drafting and law tools | Yes | Yes | No | No |
| P9 | Fees, dues, payments, income, reports | Yes | No (owner may enable per person) | No | No |
| P10 | Team, roles and permissions | Yes | **Locked** | **Locked** | **Locked** |
| P11 | Tasks | Assign, see all | See own | See own | See own |
| P12 | Settings | Chamber + personal | Personal only | Personal only | Personal only |
| P13 | Approve platform support access | Yes | No | No | No |
| P14 | Export data (Excel/PDF of lists) | Yes | No | No | No |

- **Fixed rules** (the owner cannot change them): P1, P10, P13.
- **Adjustable by the owner:** associate case scope (P3: assigned vs all) and fee visibility per associate (P9, default off).
- P11–P14 are sensible defaults that follow the owner-only principle; confirm them with the project owner (section 12).

### 3.2 Platform admin rules

- **Can see:** chambers, the owner's name and login phone (the account holder), plan, member count, case count, subscription status, the admin audit log.
- **Cannot see:** clients, client contact, case content, documents, fees and income details.
- **Support access flow:** admin writes a reason → owner gets a notification and approves or rejects in the app → grant is valid for 24 hours (owner can revoke earlier) → every admin action during the grant is logged → client contact fields stay hidden even during a grant.

### 3.3 How to enforce it

- All permission checks live in one server-only module (`src/server/authz/`) with one policy function per resource and action.
- **Field level:** client contact is stored in a separate table (`client_contacts`), encrypted at the application level, and read only by owner-scoped queries. DTO mappers for other roles never include those fields. Tests assert the fields are absent from every JSON response for non-owners.
- Non-owners cannot search, filter or sort by phone, email, NID or address.
- **Tenant isolation:** PostgreSQL Row-Level Security on `chamber_id` for every tenant table, set per request, plus the app-level policy checks. The admin portal uses a separate DB role with no access to client tables.
- **Audit log** entries for: viewing client contact, exports, role or permission changes, invitations, support access (request, approve, revoke, actions), deletions.
- **Encryption:** AES-256-GCM for client contact fields with the key from the environment or a KMS; database and backups encrypted at rest.
- **Never log PII.** Logs, error trackers and analytics must scrub client contact, OTPs and tokens.

---

## 4. Feature catalogue (F1–F59)

**Stage 1 — needs no outside permission (F1–F25)**
**Stage 2 — needs only normal business accounts: SMS gateway, WhatsApp Business, payment merchant (F26–F42)**
**Stage 3 — [PERMISSION] court data, case-law licences, official recognition (F43–F59)**

### Stage 1

**Cases and dates**
- [ ] **F1** মামলার ফাইল ও টাইমলাইন — case record (type, number, year, court, our side, parties, opposing counsel, assignee) and a timeline of every hearing and event.
- [ ] **F2** সব আদালতের মামলা এক জায়গায় — Appellate Division, High Court Division, district and subordinate courts, tribunals. Seed a court directory per district.
- [ ] **F3** দৈনিক ডায়েরি ও ক্যালেন্ডার — today and tomorrow lists per role, month calendar.
- [ ] **F4** সকালের ব্রিফিং — summary block on the owner's Today screen (hearings, tasks, dues).
- [ ] **F5** আগের রাতে ও সকালে পুশ রিমাইন্ডার — Web Push; defaults 20:00 and 07:00 Asia/Dhaka; configurable in Settings.
- [ ] **F6** প্রিন্টযোগ্য দৈনিক তালিকা ও শুনানির ইতিহাস — PDF, always light theme.
- [ ] **F7** সরকারি কোর্ট পেজের লিংক — each case links to the official page. The app does **not** fetch anything (see F43).
- [ ] **F8** Google Calendar সিঙ্ক — one-way push of hearings to the user's calendar. Needs Google OAuth; production scopes may need Google's app verification. Keep behind a flag until verified.

**Fees and accounts**
- [ ] **F9** মামলাভিত্তিক ফি, পেমেন্ট, বকেয়া.
- [ ] **F10** রসিদ বা ইনভয়েস (PDF) — sequential receipt numbers per chamber; always light.
- [ ] **F11** bKash/Nagad পেমেন্টের রেফারেন্স লিখে রাখা — payment method + reference text (manual in Stage 1).
- [ ] **F12** বকেয়া মনে করিয়ে দেওয়া — in-app dues list and reminders to the owner. In Stage 1 the owner's "remind" action opens a prefilled SMS/WhatsApp on the owner's own phone (allowed, because the owner can see the number). Stage 2 sends through the gateway with a payment link (F31).

**Clients and documents**
- [ ] **F13** ক্লায়েন্টের তথ্য — name (P2) + contact: phone, email, NID, address (P1, owner-only, encrypted).
- [ ] **F14** ডকুমেন্ট — scan, photo or file upload attached to a case; object storage with signed URLs.
- [ ] **F15** গোপন ডকুমেন্ট — visible to the uploader and the owner only (P6).
- [ ] **F16** ক্লাউড ব্যাকআপ — automated encrypted backups of DB and files, with a tested restore procedure.

**Team**
- [ ] **F17** জুনিয়র ও মুহুরি মোড — memberships, roles, case assignment, task assignment, access control.
- [ ] **F18** মুহুরি কোর্ট থেকে পরের তারিখ তুলে দেবেন — owner and assignee see it immediately (in-app + push).

**App and security**
- [ ] **F19** English ও বাংলা, মোবাইল ও ওয়েব — English is the default; one-tap switch to Bangla on the login screen and in Settings (saved per user); responsive web + installable PWA.
- [ ] **F20** Excel বা ডায়েরির ডেটা ইমপোর্ট — XLSX/CSV wizard: column mapping, preview, duplicate check.
- [ ] **F21** অফলাইন মোড — today's list and recent cases readable offline; writes (next date, order photo) go to an outbox and sync later.
- [ ] **F22** দুই ধাপের লগইন ও রোল অনুযায়ী অ্যাক্সেস — OTP + password; TOTP 2FA for owners and platform admins; RBAC per section 3.
- [ ] **F23** মাসিক রিপোর্ট — income, dues, case counts (owner, web Reports screen).

**Learning (with Hadia Academy)**
- [ ] **F24** বেসিক কম্পিউটার কোর্স (ফ্রি) — six modules: Bangla/English typing (Avro/Bijoy), Word formatting for plaints and notices, PDF scan/merge/sign, email and Google Drive, cyber safety (passwords, 2FA, phishing), using this app.
- [ ] **F25** কোর্সের ধরন — 5–10 minute Bangla videos (hosted video URLs), mobile-first player, practice with anonymised legal documents, progress tracking.

### Stage 2

**Client communication**
- [ ] **F26** শুনানির পর ক্লায়েন্টকে অটো SMS/WhatsApp — sent by the server when a next date is saved. The sender never sees the number. Client opt-out; approved templates; message log shows no number to non-owners.
- [ ] **F27** শুনানির ৭ দিন ও ২ দিন আগে ক্লায়েন্টকে রিমাইন্ডার.
- [ ] **F28** আইনজীবীকে WhatsApp-এ রিমাইন্ডার ও দৈনিক তালিকা — from the chamber's own data.
- [ ] **F29** ক্লায়েন্ট পোর্টাল — client logs in with OTP; sees case status, shared documents, dues.
- [ ] **F30** নিজের ক্লায়েন্টদের জন্য ইনটেক ফর্ম ও অ্যাপয়েন্টমেন্ট বুকিং — no public lawyer directory (see F56).

**Payments**
- [ ] **F31** bKash/Nagad পেমেন্ট লিংক — through a payment-gateway adapter; webhooks reconcile payments automatically.
- [ ] **F32** AI দিয়ে ইনভয়েসের খসড়া.

**AI (see section 7.5 for the rules)**
- [ ] **F33** ঘটনা থেকে আরজি বা পিটিশনের খসড়া — guided questions first: parties, cause-of-action date, jurisdiction, valuation, court fee, limitation, relief sought. Court format, Bangla or English, limitation and court-fee warnings, DRAFT watermark, client identity redacted before sending to AI.
- [ ] **F34** বাংলা ড্রাফট টেমপ্লেট — bail, writ, legal notice, vakalatnama.
- [ ] **F35** আইন সহজ বাংলায় — from the verified law library (source: bdlaws): official text, plain-Bangla explanation, punishment and fine table, bailable / cognizable / compoundable, last-verified date. Needs the copyright opinion first (section 12).
- [ ] **F36** অফলাইনে আইনের বই (Bare Acts).
- [ ] **F37** আদেশের ছবি থেকে পরের তারিখ ও করণীয় — AI vision extracts date and summary; the user must confirm before saving; Bangla handwriting accuracy must be tested.
- [ ] **F38** আইনজীবীর আপলোড করা রায় বা আদেশের সারাংশ.
- [ ] **F39** নতুন আইন, সংশোধনী ও প্রজ্ঞাপন — our staff enter updates manually from the Bangladesh Gazette (the Government Press gazette site blocks automated access). AI writes the plain-language summary; lawyers whose cases involve that law are notified.
- [ ] **F40** বাংলা ভয়েস নোট — speech-to-text with legal terms such as নালু, তদবির. Evaluate providers for Bangla accuracy before committing.

**Learning**
- [ ] **F41** আইনজীবীদের জন্য AI কোর্স (Hadia Academy certificate) — includes a risk module: AI can invent citations (e.g. the US case Mata v. Avianca, 2023, where lawyers were sanctioned), so every reference must be checked in DLR, BLD or an official source; never paste client secrets without anonymising.
- [ ] **F42** চেম্বার প্যাকেজ — train juniors and munshis together.

### Stage 3 — [PERMISSION]

**Court data** (Supreme Court ICT / Registrar General; Law and Justice Division / a2i; or a data partner)
- [ ] **F43** চাপ দিলে তথ্য আনা — on-demand lookup of one case from the official site.
- [ ] **F44** সুপ্রিম কোর্টের কজলিস্টের সাথে অটো মিলানো — match by lawyer name or case number; the evening before, send a printable list with court and item numbers on WhatsApp.
- [ ] **F45** নামের সব বানান — the lawyer sets name variants ("Md.", "Mohammad") for matching.
- [ ] **F46** লাইভ অ্যালার্ট — "আপনার আইটেম ৮৫, এখন চলছে ৫৪" from the bench's running-serial field.
- [ ] **F47** শুনানির ফলাফল অটো আপডেট (e.g. Heard in part, judgment date).
- [ ] **F48** জেলা আদালতের ই-কার্যতালিকা থেকে দৈনিক তারিখ ও সংক্ষিপ্ত আদেশ + client SMS.
- [ ] **F49** মামলা যোগ করার সময় পুরনো তারিখ ও আদেশের ইতিহাস ইমপোর্ট.
- [ ] **F50** প্রতিটি অটো তথ্যের পাশে উৎস, সময়, অফিসিয়াল লিংক — mismatches are resolved by the lawyer; each lawyer sees only their own cases; no public search by party name.
- [ ] **F51** প্রতিষ্ঠান মোড — banks, government offices and companies track all cases by party name.
- [ ] **F52** গেজেট অটো পড়া.

**Case law** (SCOB, DLR/BLD publishers, BDLex, Indian Kanoon API, UK Find Case Law licence, PLD Publishers)
- [ ] **F53** AI দিয়ে নজির খোঁজা — Bangladesh, India, Pakistan, UK; label binding vs persuasive (Constitution art. 111: Appellate Division law binds the High Court Division; law declared by either division binds all subordinate courts); link to the original judgment; nothing shown that is not in the licensed library.
- [ ] **F54** DLR-এর রায়ের সহজ বাংলা সারাংশ.

**Other**
- [ ] **F55** কোর্সের সার্টিফিকেটে বার কাউন্সিল বা বার সমিতির স্বীকৃতি.
- [ ] **F56** আইনজীবী ডিরেক্টরি ও নতুন ক্লায়েন্টের বুকিং — check Bar Council rules on advertising first.
- [ ] **F57** ক্লায়েন্টের NID অনলাইন যাচাই — needs a government verification service agreement.
- [ ] **F58** ভূমি ও RJSC তথ্যভান্ডারের সাথে সংযোগ.
- [ ] **F59** রায়ের পূর্বাভাস বা বিচারকের রায়ের ধরন বিশ্লেষণ — **not planned.** Ethical risk; build only if the project owner decides after legal review.

---

## 5. Screens (design references)

The 38 design screens are in `docs/design/` (light versions; files ending `Dark` show the dark theme). They show the Bangla mode, plus `MainEnglish.dc.html`, the English login people see first; English mode uses the same layouts with plain English copy. They use a template format (`<x-dc>`, `{{...}}`, `<sc-for>`). Copy the layout, spacing, colours, radii and Bangla copy, not the template syntax. Mobile artboards are 390 × 844; web artboards are 1280 × 860.

| Screen | File | Roles | Features |
|---|---|---|---|
| Login — English (default) | `MainEnglish.dc.html` | All chamber roles | F19, F22 |
| Login — Bangla mode | `Main.dc.html` | All chamber roles | F19, F22 |
| Client — owner view | `OwnerClient.dc.html` | Owner | F13, P1 |
| Client — associate view (contact locked) | `AssociateClient.dc.html` | Associate | F13, P1, P7, F26 |
| Today — munshi | `MunshiToday.dc.html` | Munshi | F3, F18, F37 |
| Today — owner home | `OwnerToday.dc.html` | Owner | F3, F4, F12, F28 |
| Today — office staff / peon | `StaffToday.dc.html` | Staff | P3, P11 |
| Case list | `CaseList.dc.html` | Owner, Associate, Munshi | F1, F2 |
| Case detail + timeline | `CaseDetail.dc.html` | Owner, Associate, Munshi | F1, F14, F9 |
| Add case | `AddCase.dc.html` | Owner, Associate | F1, F20 |
| Next date sheet | `NextDate.dc.html` | Owner, Associate, Munshi | F18, F26 |
| Order photo → date (AI) | `OrderPhoto.dc.html` | Owner, Associate, Munshi | F37 |
| Accounts | `Accounts.dc.html` | Owner | F9, F12, F31 |
| Receipt | `ReceiptView.dc.html` | Owner | F10 |
| Documents | `Documents.dc.html` | Per P5/P6 | F14, F15 |
| Notifications | `Notifications.dc.html` | All | F5, F39, P13 |
| Support access approval | `SupportApproval.dc.html` | Owner | P13, 3.2 |
| Invite member | `InviteMember.dc.html` | Owner | F17 |
| Team and permissions (web) | `TeamRoles.dc.html` | Owner | F17, section 3.1 |
| Reports (web) | `Reports.dc.html` | Owner | F23 |
| Super admin portal (web) | `SuperAdmin.dc.html` | Platform admins | 3.2 |
| Settings | `Settings.dc.html` | All | language, theme, text size, numerals, F5, F22 |
| AI draft | `AIDraft.dc.html` | Owner, Associate | F33 |
| Law in simple Bangla | `LawExplain.dc.html` | Owner, Associate | F35 (F53 shown locked) |
| Learning | `Courses.dc.html` | All | F24, F25, F41 |
| Onboarding | `Onboarding.dc.html` | New owner | chamber setup |
| Empty state | `EmptyState.dc.html` | All | first-run lists |
| Offline | `Offline.dc.html` | All | F21 |
| Dark references | `MainDark`, `OwnerClientDark`, `AssociateClientDark`, `MunshiTodayDark`, `TeamRolesDark`, `OwnerTodayDark`, `CaseDetailDark`, `AccountsDark`, `AIDraftDark`, `SettingsDark` | — | theme check |

**Stage notes for screens**
- WhatsApp and client-SMS mentions (OwnerToday footer, NextDate toggle, Settings "WhatsApp-এ ডেইলি লিস্ট", AssociateClient send button) appear only when F26/F28 are live. Before that: the owner gets "open prefilled SMS on my phone"; associates see no send button.
- LawExplain values in [brackets] are placeholders; real text comes from the verified library (F35).
- Sample names, case numbers and amounts in the designs are fictional. Use them only as seed/demo data.

---

## 6. Data model (PostgreSQL)

Every tenant table has `chamber_id` (RLS), `created_at`, `updated_at`, and soft-delete where noted.

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, phone (unique), name, password_hash, totp_secret_enc, locale, theme, text_size, numerals | Argon2id hashes |
| `chambers` | id, name, district, plan, status, trial_ends_at | |
| `memberships` | id, user_id, chamber_id, role (owner/associate/munshi/staff), case_scope (all/assigned), can_see_fees, status (invited/active/revoked) | One owner per chamber |
| `invitations` | id, chamber_id, phone, role, token_hash, expires_at, accepted_at | SMS invite |
| `platform_admins` | id, user_id, role (super_admin/support) | Separate portal |
| `support_grants` | id, chamber_id, admin_id, reason, requested_at, approved_by, approved_at, expires_at, revoked_at | 24h |
| `courts` | id, name_bn, name_en, level, district, official_url | Seeded |
| `clients` | id, chamber_id, display_name, created_by | Name only |
| `client_contacts` | client_id, phone_enc, email_enc, nid_enc, address_enc, consent_at | **Owner-only**, encrypted |
| `cases` | id, chamber_id, type, number, year, court_id, our_side, client_id, parties_text, opposing_counsel, assignee_membership_id, status | |
| `hearings` | id, case_id, date, serial_or_item, purpose, outcome_note, source (manual/photo_ai/court_sync), added_by, source_url, fetched_at | source fields for Stage 3 |
| `documents` | id, case_id, kind, title, storage_key, confidential, uploaded_by | P5/P6 |
| `tasks` | id, chamber_id, assignee_membership_id, case_id?, title, due_at, done_at, created_by | Staff tasks |
| `fees` | id, case_id, client_id, amount, description | |
| `payments` | id, chamber_id, client_id, case_id, amount, method (cash/bkash/nagad/bank/gateway), reference, received_by, receipt_no | Unique receipt_no per chamber |
| `notifications` | id, user_id, type, payload, read_at | In-app |
| `push_subscriptions` | id, user_id, endpoint, keys | Web Push |
| `outbound_messages` | id, chamber_id, client_id, channel (sms/whatsapp), template, status, triggered_by, sent_at | Never expose number to non-owners |
| `audit_log` | id, chamber_id?, actor_user_id, actor_kind (member/admin), action, entity, entity_id, fields, ip, at | Append-only |
| `courses`, `course_modules`, `course_progress` | … | F24, F25, F41 |
| `law_acts`, `law_sections`, `law_versions` | act, section, text, plain_explanation, punishment_json, source_url, verified_at | F35 (Stage 2) |
| `gazette_updates` | id, title, act_id, effective_date, summary, source_note, entered_by | F39 (manual) |
| `ai_drafts` | id, chamber_id, case_id?, kind, redacted_input, output, created_by | F33 |
| `feature_flags` | key, enabled, scope (global/chamber) | Stage 3 gating |

---

## 7. Architecture

### 7.1 Stack
- **Next.js (App Router, current stable) + TypeScript (strict)**, pnpm.
- **Tailwind CSS** with the design tokens as CSS variables (see CLAUDE.md), **shadcn/ui (Radix)** primitives restyled to our tokens.
- **PostgreSQL** (current stable) with **Prisma**; Row-Level Security; **pgvector** later for AI retrieval.
- **pg-boss** (Postgres-backed) for scheduled jobs and queues, so no extra Redis is needed.
- **S3-compatible object storage** (MinIO in development) with server-side encryption and signed URLs.
- **Web Push (VAPID)** for reminders; a service worker for offline (choose a maintained Next.js-compatible library and verify it before adding).
- **IndexedDB** (e.g. Dexie) for the offline cache and the outbox queue.
- **next-intl** for English (default) and Bangla. In Bangla mode use `Intl` with `bn-BD` for Bangla digits and dates; time zone `Asia/Dhaka` in both.
- **PDF:** render HTML to PDF with headless Chromium (Playwright). Many JS PDF libraries break Bangla conjuncts (যুক্তাক্ষর); test every PDF with conjunct-heavy text.
- **Excel import:** SheetJS or exceljs.
- **Docker Compose** for app, Postgres and MinIO so hosting stays portable (hosting location is an open decision).

### 7.2 Modules
`auth` · `chambers-team` · `clients` · `cases-hearings` · `documents` · `accounts` · `reminders-notifications` · `import` · `learning` · `admin-portal` · `ai` (Stage 2) · `law-library` (Stage 2) · `court-data` (Stage 3).

### 7.3 Integration adapters (interfaces first, providers later)
- `SmsProvider` — dev: console; prod: a Bangladeshi SMS gateway (vendor to be chosen).
- `WhatsAppProvider` — WhatsApp Business Platform (needs business verification and approved templates).
- `PaymentProvider` — bKash/Nagad directly or through an aggregator (to be chosen).
- `AiProvider` — Anthropic API; model names from environment variables, never hard-coded.
- `SpeechToTextProvider` — to be evaluated for Bangla (F40).
- `CourtDataSource` — default `ManualSource` only. Official sources are added in Stage 3 behind flags.
- `StorageProvider` — S3-compatible.

### 7.4 Background jobs (Asia/Dhaka)
- 20:00 night reminder, 07:00 morning reminder (per user settings).
- Client reminders 7 and 2 days before hearings (F27, Stage 2).
- Support-grant expiry sweep (every 5 minutes).
- Daily encrypted backup + weekly restore check in staging.

### 7.5 AI rules (Stage 2)
- Retrieval-augmented generation only: answers are built from our verified library (law sections, templates) and the user's own uploaded documents. The model is never asked to recall law or cases from memory.
- Any citation in an answer must map to a record in the library; otherwise it is removed and the user is told nothing was found.
- Client names, phone numbers, NID and addresses are redacted before any AI call.
- Drafts carry a DRAFT watermark and a "the lawyer decides" note.
- Store prompts and outputs per chamber for the lawyer's review; never use them for anything else.

### 7.6 Offline
- Cache: today's and tomorrow's hearings, the last 50 opened cases, the user's tasks.
- Outbox: next date, order photo, task done. Sync on reconnect; conflicts resolved by "last write wins + keep both in the timeline" and the user is told.
- The offline banner and pending-changes card follow `Offline.dc.html`.

---

## 8. Security, privacy and compliance checklist

- [ ] Section 3 rules implemented and covered by the permission test suite.
- [ ] RLS enabled and tested on every tenant table.
- [ ] Client contact encrypted; key rotation documented.
- [x] OTP: 6 digits, 5-minute expiry, attempt limit, rate limit per phone and IP.
- [ ] TOTP 2FA mandatory for owners (after onboarding) and all platform admins; admin portal on a separate subdomain.
- [ ] Session security: httpOnly, Secure, SameSite cookies; device list and remote logout (Settings).
- [ ] No PII in logs or error reports.
- [ ] Consent screen and privacy notice at onboarding (PDPO); record `consent_at`.
- [ ] Backups encrypted; restore tested.
- [ ] Hosting location decided with legal advice (section 12).
- [ ] Every Stage 3 feature flag OFF until `docs/permissions/<id>.md` exists.

---

## 9. Milestones

### M0 — Foundation
- [x] Scaffold Next.js + TypeScript (strict) + pnpm; ESLint, Prettier; Vitest; Playwright; GitHub Actions CI.
- [x] Design tokens (light, dark), theme switch Light / Dark / System (default System), fonts.
- [x] next-intl with English default and Bangla; language switch on the login screen and in Settings; numerals preference (Bangla / English digits) in Bangla mode.
- [x] App shells: mobile bottom tabs per role (owner 5 tabs, associate 5, munshi 4, staff 3 — see designs); web sidebar (owner); admin portal shell on its own route group/subdomain.
- [ ] Docker Compose (app, Postgres, MinIO); `.env.example`.
- **Done when:** `pnpm dev` runs, theme switches correctly in both modes, the PWA is installable, CI is green.

### M1 — Auth, chambers, audit
- [x] Phone OTP login (console SMS provider in dev), password (Argon2id), sessions, TOTP.
- [x] Onboarding creates the chamber and the owner membership, with the consent step (`Onboarding.dc.html`).
- [x] Invitations by SMS; accept → active membership with the chosen role (`InviteMember.dc.html`).
- [x] `authz` module, RLS policies, audit log.
- **Done when:** login, invite and role tests pass; two test chambers cannot see each other's data at DB and API level.

### M2 — Cases core (F1–F4, F7, F13, F17–F19)
- [ ] Courts seed; clients + encrypted `client_contacts`; cases CRUD; hearings timeline.
- [ ] Today screens for owner, munshi and staff; case list with search and filters; month calendar; next-date sheet; official court link.
- **Done when:** P1–P4 tests pass (associate JSON never contains contact fields; staff never receives client names); the next-date sheet works on a 390 px screen.

### M3 — Team, tasks, platform admin (F17, P9–P14, section 3.2)
- [ ] Team and permissions page (fixed vs adjustable rules), case scope, per-associate fee toggle, staff tasks.
- [ ] Admin portal: chambers list, plans (manual assignment and payment record), support request → owner approval → 24-hour grant, admin audit log.
- **Done when:** a grant expires automatically after 24 hours; the admin DB role cannot read client tables; every support action is logged.

### M4 — Documents, accounts, receipts, reports (F9–F12, F14–F15, F23)
- [ ] Upload/scan/photo, confidential flag, signed URLs.
- [ ] Fees, payments, dues, receipts (HTML → PDF, always light), owner's prefilled-SMS reminder, web Reports.
- **Done when:** confidential-document tests pass; a Bangla receipt PDF renders conjuncts correctly; receipt numbers are unique per chamber.

### M5 — Reminders, printing, calendar, offline (F5, F6, F8, F16, F21)
- [ ] Web Push; 20:00 and 07:00 jobs; notification centre; printable daily list and hearing history.
- [ ] Google Calendar one-way sync (behind a flag until Google verification).
- [ ] Offline cache + outbox; automated backups.
- **Done when:** jobs fire at the right Asia/Dhaka time; a next date saved offline syncs after reconnecting; a restore from backup works in staging.

### M6 — Import, empty states, settings, learning (F20, F24, F25)
- [ ] Excel/CSV import wizard with mapping, preview and duplicate check.
- [ ] Empty states, settings (text size, numerals, reminder times, devices).
- [ ] Course player with progress for the basic computer course.
- **Done when:** a sample diary spreadsheet imports cleanly with duplicates flagged; empty states match `EmptyState.dc.html`.

### M7 — Stage 2a: client messaging, portal, payments (F26–F31)
- [ ] SMS and WhatsApp adapters, send-without-revealing, opt-out, delivery log.
- [ ] Client portal, intake form, appointment booking.
- [ ] Payment links + webhooks for bKash/Nagad.
- **Done when:** an associate can trigger a client SMS and no response ever contains the number; payments reconcile from webhooks.

### M8 — Stage 2b: AI, law library, learning (F32–F42)
- [ ] `AiProvider` with redaction; drafting with the checklist (F33); templates (F34).
- [ ] Law library + plain-Bangla explanations (F35, after the copyright opinion), offline acts (F36).
- [ ] Order-photo extraction with confirmation (F37); summaries (F38); manual gazette updates with notifications (F39); voice notes after evaluation (F40); AI course and chamber package (F41, F42); invoice draft (F32).
- **Done when:** adversarial tests show no citation outside the library; redaction tests pass; every draft carries the DRAFT watermark.

### M9 — Stage 3: permission-gated (F43–F59)
- [ ] For each feature: permission note in `docs/permissions/` → implement the `CourtDataSource` or licence adapter → polite fetching (caching, rate limits, identifiable user agent, no bypassing CAPTCHAs, logins or IP blocks) → flag ON for a pilot chamber first.
- [ ] F59 stays unbuilt unless decided otherwise.

---

## 10. Testing

- **Unit (Vitest):** policies, DTO mappers, date/numeral formatting, receipt numbering.
- **Permission suite (must pass in CI):** one test per P-rule per role, at API level and for UI visibility.
- **E2E (Playwright):** per-role journeys at 390 px (mobile) and 1280 px (web), in light and dark themes.
- **Accessibility:** axe checks; keyboard focus visible; touch targets ≥ 44 px; text contrast ≥ 4.5:1.
- **Bangla rendering:** screenshots and PDFs with conjunct-heavy text (e.g. যুক্তাক্ষর, ক্ষ্ম, স্ত্র).
- **Offline:** outbox sync, conflict handling.

---

## 11. Environments and deployment

- Environments: local (Docker Compose), staging, production.
- Secrets only in environment variables; `.env.example` documents every variable.
- Migrations run automatically on deploy; seed data only in local and staging.
- Hosting location: decide after the legal opinion (section 12). Keep everything containerised so moving providers is easy.

---

## 12. Open decisions (need the project owner)

1. Brand: the name is decided (ধারা / Dhara). Still to do: domain, trademark search and filing with DPDT, app-store and social-handle checks, logo.
2. Hosting location under the data protection law (legal opinion).
3. SMS gateway vendor; WhatsApp Business verification.
4. Payment route: bKash/Nagad direct or an aggregator.
5. Copyright opinion on using bdlaws and Gazette text (F35, F39).
6. Pricing for Solo / Chamber / Organization plans after the pilot.
7. Confirm defaults P11–P14; whether a munshi may record cash payments (currently no).
8. Court-data permission route: Supreme Court ICT / Registrar General, Law and Justice Division / a2i, or a partnership (F43–F52).
9. Case-law licences: SCOB, DLR/BLD publishers, BDLex, Indian Kanoon API, UK Find Case Law licence, PLD Publishers (F53–F54).
10. Recognition and agreements: Bar Council / bar associations (F55, F56), NID verification (F57), land and RJSC (F58).

---

## 13. Glossary

| Bangla | Meaning |
|---|---|
| মুহুরি | Munshi, the lawyer's clerk |
| ওকালতনামা | Vakalatnama, the client's authorisation for the advocate |
| আরজি | Plaint |
| কার্যতালিকা / কজলিস্ট | Cause list (daily list of cases before a court) |
| ক্রমিক / আইটেম নম্বর | Serial or item number of a case in the cause list |
| পরের তারিখ | Next hearing date |
| আদেশ | Order of the court |
| বাদী / বিবাদী | Plaintiff / defendant |
| সিআর মামলা | Complaint register (criminal) case |
| অর্থঋণ আদালত | Money loan court |
| তামাদি | Limitation period |
| এখতিয়ার | Jurisdiction |
| মূল্যমান | Valuation of the suit |
| কোর্ট ফি | Court fee |
| জামিনযোগ্য / আমলযোগ্য / আপসযোগ্য | Bailable / cognizable / compoundable |
| প্রজ্ঞাপন | Official notification (Gazette) |
| নজির | Precedent |

---

## 14. Wording in Bangla mode

English is the default language. In Bangla mode, write the way people actually talk:

- **App words → the common English word in Bangla script.** Not the bookish Bangla word.
- **Legal words → the Bangla terms lawyers use in court.** Keep them as they are.
- **Official names → exactly as written in court records** (case types like দেওয়ানি মামলা, সিআর মামলা; court names like যুগ্ম জেলা জজ আদালত-২). Client SMS may say "আপনার মামলার পরের তারিখ" because that is how clients talk.

| English (default) | Bangla mode | Do not use |
|---|---|---|
| Team | টিম | দল |
| Member | মেম্বার | সদস্য |
| Role | রোল | ভূমিকা |
| Permission | পারমিশন | অনুমতি |
| Owner / Associate / Munshi / Office staff | ওনার / অ্যাসোসিয়েট / মুহুরি / অফিস স্টাফ | চেম্বার মালিক / সহযোগী আইনজীবী |
| Invite | ইনভাইট | আমন্ত্রণ |
| Active | অ্যাক্টিভ | সক্রিয় |
| Approve / Reject / Request | অ্যাপ্রুভ / রিজেক্ট / রিকোয়েস্ট | অনুমোদন / বাতিল / অনুরোধ |
| Save / Add / Edit / Search | সেভ করুন / অ্যাড করুন / এডিট / সার্চ করুন | সংরক্ষণ / যোগ / বদলান / খুঁজুন |
| List | লিস্ট | তালিকা |
| Case (generic label) | কেস | মামলা |
| Hearing | হিয়ারিং | শুনানি |
| Court order | অর্ডার | আদেশ |
| Court (generic label) | কোর্ট | আদালত |
| Assigned | অ্যাসাইন করা | নির্ধারিত / দায়িত্বে |
| Draft / Summary | ড্রাফট / সামারি | খসড়া / সারাংশ |
| Contact / Private | কন্টাক্ট / প্রাইভেট | যোগাযোগ / গোপন |
| Security / Two-step verification | সিকিউরিটি / টু-স্টেপ ভেরিফিকেশন | নিরাপত্তা / দুই ধাপের যাচাই |
| Display / Font size / Language | ডিসপ্লে / ফন্ট সাইজ / ল্যাঙ্গুয়েজ | দেখতে কেমন / লেখার আকার / ভাষা |
| Collection / Recent / Amount | কালেকশন / রিসেন্ট / অ্যামাউন্ট | আদায় / সাম্প্রতিক / পরিমাণ |
| Step / Setup | স্টেপ / সেটআপ | ধাপ / তৈরি |
| Courses | কোর্স | শেখা |

**Keep in Bangla (legal terms):** আরজি, ওকালতনামা, জামিন, রিট, বাদী, বিবাদী, মুহুরি, তারিখ, পরের তারিখ, তামাদি, এখতিয়ার, মূল্যমান, প্রতিকার, জামিনযোগ্য, আমলযোগ্য, আপসযোগ্য, ধারা, রায়, সমন, ক্রমিক.

**Everyday words stay Bangla:** আজ, কাল, নতুন, সব, বাকি, ফি, বকেয়া, হিসাব, রসিদ, ঠিকানা, নাম, নম্বর.

When a new word comes up, ask: "Which word would a lawyer in Chattogram say out loud?" and use that one. Add it to this table.

