-- SECURITY DEFINER functions (support access, reminders) run as the role that owns the tables.
-- In development and CI that role is a superuser and skips RLS; on a managed database it usually is not,
-- and FORCE ROW LEVEL SECURITY then applies to it too. These policies let only the owning role through,
-- recognised by current_user, which the app, admin and jobs roles can never become.
CREATE FUNCTION app_is_definer() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_user::text = (SELECT tableowner::text FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users')
$$;
GRANT EXECUTE ON FUNCTION app_is_definer() TO dhara_app, dhara_admin, dhara_jobs;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'memberships', 'chambers', 'cases', 'hearings', 'courts', 'tasks',
                           'support_grants', 'audit_log', 'notifications', 'reminder_log']
  LOOP
    EXECUTE format('CREATE POLICY definer_all ON %I USING (app_is_definer()) WITH CHECK (app_is_definer())', t);
  END LOOP;
END $$;
