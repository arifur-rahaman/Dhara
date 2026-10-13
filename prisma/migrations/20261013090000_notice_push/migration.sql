-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "pushed_at" TIMESTAMPTZ;


-- Notices from before this change, and reminders (pushed by jobs_claim_reminders), are never pushed here.
UPDATE notifications SET pushed_at = created_at;
CREATE INDEX notifications_unpushed_idx ON notifications (created_at) WHERE pushed_at IS NULL;

-- F18: the worker pushes new in-app notices (a next date, a task, a support request) within about a minute.
-- Like jobs_claim_reminders, the jobs role gets counts per person and nothing else, and each notice is
-- claimed once. Notices older than a day are not pushed late.
CREATE FUNCTION jobs_claim_push_notices()
RETURNS TABLE (user_id uuid, dates int, tasks int, other int, locale text, numerals text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE notifications n SET pushed_at = now()
    WHERE n.pushed_at IS NULL AND n.kind NOT LIKE 'reminder.%' AND n.created_at > now() - interval '1 day'
    RETURNING n.user_id, n.kind
  )
  SELECT c.user_id,
         count(*) FILTER (WHERE c.kind = 'hearing.added')::int,
         count(*) FILTER (WHERE c.kind = 'task.assigned')::int,
         count(*) FILTER (WHERE c.kind NOT IN ('hearing.added', 'task.assigned'))::int,
         u.locale, u.numerals
  FROM claimed c JOIN users u ON u.id = c.user_id
  GROUP BY c.user_id, u.locale, u.numerals;
END $$;
REVOKE ALL ON FUNCTION jobs_claim_push_notices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION jobs_claim_push_notices() TO dhara_jobs;
