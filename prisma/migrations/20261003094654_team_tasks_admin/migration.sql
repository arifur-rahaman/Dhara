-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'support');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "assignee_membership_id" UUID NOT NULL,
    "case_id" UUID,
    "title" TEXT NOT NULL,
    "due_on" DATE,
    "done_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret_enc" TEXT NOT NULL,
    "totp_last_step" BIGINT,
    "disabled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "admin_id" UUID NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" UUID NOT NULL,
    "admin_id" UUID,
    "action" TEXT NOT NULL,
    "chamber_id" UUID,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "fields" JSONB,
    "ip_hash" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_grants" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "rejected_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "support_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "amount_poisha" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paid_on" DATE NOT NULL,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_chamber_id_assignee_membership_id_idx" ON "tasks"("chamber_id", "assignee_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_phone_key" ON "platform_admins"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_log_at_idx" ON "admin_audit_log"("at");

-- CreateIndex
CREATE INDEX "support_grants_chamber_id_idx" ON "support_grants"("chamber_id");

-- CreateIndex
CREATE INDEX "subscription_payments_chamber_id_idx" ON "subscription_payments"("chamber_id");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- M3: tasks, platform admin, support access (plan.md 3.2, TECH_GUIDE sections 4 and 6)
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_admin_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.admin_id', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION app_admin_id(), app_chamber_id(), app_user_id(), app_role(), app_invite_token_hash(), app_user_phone() TO dhara_admin;

-- tasks (P11): tenant table for the chamber app only.
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tasks
  USING (chamber_id = app_chamber_id()) WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON tasks TO dhara_app;

-- Admin-only tables. The chamber app has no grants on them, except admin names for the approval screen.
GRANT UPDATE (totp_last_step, updated_at) ON platform_admins TO dhara_admin;
GRANT SELECT ON platform_admins TO dhara_admin;
GRANT SELECT (id, name) ON platform_admins TO dhara_app;
GRANT SELECT, INSERT, UPDATE ON admin_sessions TO dhara_admin;
GRANT SELECT, INSERT ON admin_audit_log TO dhara_admin;
GRANT SELECT, INSERT ON subscription_payments TO dhara_admin;
GRANT SELECT, INSERT, DELETE ON auth_attempts TO dhara_admin;

-- support_grants: the chamber sees its own requests and decides; admins see all, and may only file requests in their own name.
ALTER TABLE support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON support_grants
  USING (chamber_id = app_chamber_id()) WITH CHECK (chamber_id = app_chamber_id());
CREATE POLICY admin_read ON support_grants FOR SELECT TO dhara_admin USING (true);
CREATE POLICY admin_request ON support_grants FOR INSERT TO dhara_admin
  WITH CHECK (admin_id = app_admin_id() AND approved_at IS NULL AND approved_by IS NULL AND expires_at IS NULL);
GRANT SELECT, UPDATE (approved_by, approved_at, rejected_at, expires_at, revoked_at) ON support_grants TO dhara_app;
GRANT SELECT, INSERT ON support_grants TO dhara_admin;

-- What the admin role may see of chamber data: account fields and counts only (plan.md 3.2).
GRANT SELECT (id, name, district, plan, status, trial_ends_at, created_at) ON chambers TO dhara_admin;
GRANT UPDATE (plan, status, trial_ends_at, updated_at) ON chambers TO dhara_admin;
CREATE POLICY admin_account ON chambers FOR SELECT TO dhara_admin USING (true);
CREATE POLICY admin_plan ON chambers FOR UPDATE TO dhara_admin USING (true) WITH CHECK (true);

GRANT SELECT (chamber_id, user_id, role, status) ON memberships TO dhara_admin;
CREATE POLICY admin_count ON memberships FOR SELECT TO dhara_admin USING (true);

GRANT SELECT (chamber_id, status, deleted_at) ON cases TO dhara_admin;
CREATE POLICY admin_count ON cases FOR SELECT TO dhara_admin USING (true);

-- users: the app reads all people (sign-in); the admin role sees only chamber owners' name and login phone.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY app_all ON users TO dhara_app USING (true) WITH CHECK (true);
CREATE POLICY admin_owner_accounts ON users FOR SELECT TO dhara_admin
  USING (EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = users.id AND m.role = 'owner'));
GRANT SELECT (id, name, phone) ON users TO dhara_admin;

-- Chamber list for the admin portal (SuperAdmin design). Runs with the caller's rights, so the grants above apply.
CREATE VIEW admin_chamber_overview WITH (security_invoker = true) AS
SELECT
  c.id, c.name, c.district, c.plan, c.status, c.trial_ends_at, c.created_at,
  (SELECT u.name FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.chamber_id = c.id AND m.role = 'owner' AND m.status = 'active' LIMIT 1) AS owner_name,
  (SELECT u.phone FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.chamber_id = c.id AND m.role = 'owner' AND m.status = 'active' LIMIT 1) AS owner_phone,
  (SELECT count(*) FROM memberships m WHERE m.chamber_id = c.id AND m.status = 'active')::int AS member_count,
  (SELECT count(*) FROM cases k WHERE k.chamber_id = c.id AND k.deleted_at IS NULL AND k.status = 'active')::int AS case_count
FROM chambers c;
GRANT SELECT ON admin_chamber_overview TO dhara_admin;

-- Support view: case numbers and dates of one chamber, only during an approved, unexpired grant held by this admin.
-- Runs as the function owner with the chamber context set inside, so normal RLS applies and the role is 'support'
-- (never 'owner'), which keeps client_contacts hidden. Each call is logged for the owner and for the platform.
CREATE FUNCTION admin_support_cases(p_chamber uuid)
RETURNS TABLE (case_type text, number text, year text, court_name text, court_no text, next_date date, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := app_admin_id();
  v_prev_chamber text := current_setting('app.chamber_id', true);
  v_prev_role text := current_setting('app.role', true);
BEGIN
  IF v_admin IS NULL THEN RAISE EXCEPTION 'no admin context'; END IF;
  PERFORM set_config('app.chamber_id', p_chamber::text, true);
  PERFORM set_config('app.role', 'support', true);
  IF NOT EXISTS (
    SELECT 1 FROM support_grants g
    WHERE g.chamber_id = p_chamber AND g.admin_id = v_admin
      AND g.approved_at IS NOT NULL AND g.revoked_at IS NULL AND g.rejected_at IS NULL AND g.expires_at > now()
  ) THEN
    PERFORM set_config('app.chamber_id', coalesce(v_prev_chamber, ''), true);
    PERFORM set_config('app.role', coalesce(v_prev_role, ''), true);
    RAISE EXCEPTION 'no active support grant' USING ERRCODE = '42501';
  END IF;

  INSERT INTO audit_log (id, chamber_id, actor_user_id, actor_kind, action, entity, entity_id, fields)
  VALUES (gen_random_uuid(), p_chamber, NULL, 'admin', 'support.view_cases', 'chamber', p_chamber::text,
          jsonb_build_object('adminId', v_admin));
  INSERT INTO admin_audit_log (id, admin_id, action, chamber_id, entity, entity_id)
  VALUES (gen_random_uuid(), v_admin, 'support.view_cases', p_chamber, 'chamber', p_chamber::text);

  RETURN QUERY
    SELECT k.type::text, k.number, k.year, ct.name_bn, k.court_no,
           (SELECT min(h.date) FROM hearings h WHERE h.case_id = k.id AND h.date >= (now() AT TIME ZONE 'Asia/Dhaka')::date),
           k.status::text
    FROM cases k JOIN courts ct ON ct.id = k.court_id
    WHERE k.chamber_id = p_chamber AND k.deleted_at IS NULL
    ORDER BY k.created_at DESC
    LIMIT 500;

  PERFORM set_config('app.chamber_id', coalesce(v_prev_chamber, ''), true);
  PERFORM set_config('app.role', coalesce(v_prev_role, ''), true);
END $$;
REVOKE ALL ON FUNCTION admin_support_cases(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_support_cases(uuid) TO dhara_admin;
