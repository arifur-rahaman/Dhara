-- Row-Level Security and database roles (TECH_GUIDE section 4, plan.md 3.3).
-- The app connects as dhara_app: not a superuser, not the table owner, so RLS applies.
-- The admin portal connects as dhara_admin: no grants on tenant tables (views come in M3).
-- Roles are created without LOGIN; scripts/db-roles.mjs sets LOGIN and passwords from the environment.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_app') THEN
    CREATE ROLE dhara_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_admin') THEN
    CREATE ROLE dhara_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO dhara_app, dhara_admin;

-- Request context, set per transaction by src/server/db/tenant.ts with set_config(..., true).
CREATE FUNCTION app_chamber_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.chamber_id', true), '')::uuid $$;
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE FUNCTION app_invite_token_hash() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.invite_token_hash', true), '') $$;
CREATE FUNCTION app_user_phone() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_phone', true), '') $$;
GRANT EXECUTE ON FUNCTION app_chamber_id(), app_user_id(), app_invite_token_hash(), app_user_phone() TO dhara_app;

-- Non-tenant tables: people, sessions and login codes.
GRANT SELECT, INSERT, UPDATE, DELETE ON users, sessions, otp_challenges TO dhara_app;

-- memberships: rows of the current chamber, plus the signed-in user's own memberships (chamber switcher).
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships
  USING (chamber_id = app_chamber_id() OR user_id = app_user_id())
  WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON memberships TO dhara_app;

-- invitations: rows of the current chamber, the one invitation whose token the visitor holds,
-- and open invitations sent to the signed-in user's own phone number.
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invitations
  USING (
    chamber_id = app_chamber_id()
    OR token_hash = app_invite_token_hash()
    OR (phone = app_user_phone() AND accepted_at IS NULL AND revoked_at IS NULL)
  )
  WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON invitations TO dhara_app;

-- chambers: the current chamber, chambers the user belongs to, and the chamber of a held invitation.
ALTER TABLE chambers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chambers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chambers
  USING (
    id = app_chamber_id()
    OR EXISTS (SELECT 1 FROM memberships m WHERE m.chamber_id = chambers.id AND m.user_id = app_user_id() AND m.status = 'active')
    OR EXISTS (SELECT 1 FROM invitations i WHERE i.chamber_id = chambers.id
               AND (i.token_hash = app_invite_token_hash()
                    OR (i.phone = app_user_phone() AND i.accepted_at IS NULL AND i.revoked_at IS NULL)))
  )
  WITH CHECK (id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON chambers TO dhara_app;

-- audit_log: append-only. Chamber events are visible only inside that chamber;
-- user-level events (sign-in) carry no chamber and are not readable by the app.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON audit_log FOR SELECT USING (chamber_id = app_chamber_id());
CREATE POLICY tenant_append ON audit_log FOR INSERT
  WITH CHECK (chamber_id IS NULL OR chamber_id = app_chamber_id());
GRANT SELECT, INSERT ON audit_log TO dhara_app;
