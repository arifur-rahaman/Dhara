-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reminder_morning_at" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "reminder_morning_on" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminder_night_at" TEXT NOT NULL DEFAULT '20:00',
ADD COLUMN     "reminder_night_on" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_success_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chamber_id" UUID,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_log" (
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "local_date" DATE NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("user_id","kind","local_date")
);

-- CreateTable
CREATE TABLE "sync_receipts" (
    "key" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "result" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_receipts_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sync_receipts_user_id_idx" ON "sync_receipts"("user_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- M5: reminders, notifications, offline sync (TECH_GUIDE sections 11 and 12).
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD CONSTRAINT users_reminder_times
  CHECK (reminder_night_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND reminder_morning_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- The jobs worker connects as dhara_jobs: it owns the pg-boss queue schema and may call the reminder
-- function below, which returns only counts. It has no grants on any chamber table.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_jobs') THEN
    CREATE ROLE dhara_jobs NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION dhara_jobs;
GRANT USAGE ON SCHEMA public TO dhara_jobs;

-- push_subscriptions: each person manages their own devices; the jobs role sends and prunes.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY own_devices ON push_subscriptions TO dhara_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY jobs_send ON push_subscriptions TO dhara_jobs USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO dhara_app;
GRANT SELECT, DELETE ON push_subscriptions TO dhara_jobs;
GRANT UPDATE (last_success_at) ON push_subscriptions TO dhara_jobs;

-- notifications: a person reads and marks their own; a member may notify another active member
-- of the same chamber (e.g. "next date added"), never someone outside it.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY own_read ON notifications FOR SELECT TO dhara_app USING (user_id = app_user_id());
CREATE POLICY own_mark ON notifications FOR UPDATE TO dhara_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
CREATE POLICY notify_member ON notifications FOR INSERT TO dhara_app
  WITH CHECK (
    chamber_id = app_chamber_id()
    AND EXISTS (SELECT 1 FROM memberships m WHERE m.chamber_id = app_chamber_id()
                AND m.user_id = notifications.user_id AND m.status = 'active')
  );
GRANT SELECT, INSERT ON notifications TO dhara_app;
GRANT UPDATE (read_at) ON notifications TO dhara_app;

-- reminder_log is written only by the reminder function.
ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_log FORCE ROW LEVEL SECURITY;

-- sync_receipts: the offline outbox's "already applied" record, per person and chamber.
ALTER TABLE sync_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY own_receipts ON sync_receipts TO dhara_app
  USING (user_id = app_user_id() AND chamber_id = app_chamber_id())
  WITH CHECK (user_id = app_user_id() AND chamber_id = app_chamber_id());
GRANT SELECT, INSERT ON sync_receipts TO dhara_app;

-- Reminders due at one Asia/Dhaka minute (F5). Claims each person's reminder for the day exactly once
-- (so overlapping workers never double-send), writes the in-app notification, and returns counts only:
-- push text never carries client names or case details (TECH_GUIDE section 12).
-- Counts follow each membership's visibility (P3): owner, munshi and staff all cases; associates by scope.
CREATE FUNCTION jobs_claim_reminders(p_kind text, p_hhmm text, p_today date)
RETURNS TABLE (user_id uuid, hearings int, tasks int, locale text, numerals text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day date := CASE WHEN p_kind = 'night' THEN p_today + 1 ELSE p_today END;
BEGIN
  IF p_kind NOT IN ('night', 'morning') OR p_hhmm !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'bad reminder arguments' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH due_users AS (
    SELECT u.id, u.locale, u.numerals FROM users u
    WHERE (p_kind = 'night' AND u.reminder_night_on AND u.reminder_night_at = p_hhmm)
       OR (p_kind = 'morning' AND u.reminder_morning_on AND u.reminder_morning_at = p_hhmm)
  ),
  per_member AS (
    SELECT m.user_id, m.chamber_id,
      (SELECT count(*) FROM hearings h JOIN cases k ON k.id = h.case_id
        WHERE k.chamber_id = m.chamber_id AND k.deleted_at IS NULL AND h.date = v_day
          AND (m.role <> 'associate' OR m.case_scope = 'all' OR k.assignee_membership_id = m.id))::int AS hearings,
      CASE WHEN p_kind = 'morning' THEN
        (SELECT count(*) FROM tasks t WHERE t.assignee_membership_id = m.id AND t.done_at IS NULL
          AND (t.due_on IS NULL OR t.due_on <= p_today))::int ELSE 0 END AS tasks
    FROM memberships m JOIN due_users d ON d.id = m.user_id
    JOIN chambers c ON c.id = m.chamber_id AND c.status <> 'suspended'
    WHERE m.status = 'active'
  ),
  totals AS (
    SELECT p.user_id, sum(p.hearings)::int AS hearings, sum(p.tasks)::int AS tasks,
           (array_agg(p.chamber_id ORDER BY p.hearings DESC))[1] AS chamber_id
    FROM per_member p GROUP BY p.user_id
    HAVING sum(p.hearings) + sum(p.tasks) > 0
  ),
  claimed AS (
    INSERT INTO reminder_log (user_id, kind, local_date)
    SELECT t.user_id, p_kind, p_today FROM totals t
    ON CONFLICT DO NOTHING
    RETURNING reminder_log.user_id
  ),
  noted AS (
    INSERT INTO notifications (id, user_id, chamber_id, kind, payload)
    SELECT gen_random_uuid(), t.user_id, t.chamber_id, 'reminder.' || p_kind,
           jsonb_build_object('hearings', t.hearings, 'tasks', t.tasks, 'date', v_day)
    FROM totals t JOIN claimed c ON c.user_id = t.user_id
    RETURNING notifications.user_id
  )
  SELECT t.user_id, t.hearings, t.tasks, d.locale, d.numerals
  FROM totals t JOIN claimed c ON c.user_id = t.user_id JOIN due_users d ON d.id = t.user_id
  WHERE (SELECT count(*) FROM noted) >= 0;
END $$;
REVOKE ALL ON FUNCTION jobs_claim_reminders(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION jobs_claim_reminders(text, text, date) TO dhara_jobs;
