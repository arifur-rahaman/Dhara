-- Support requests go through one function so the owner's activity log and the admin audit log
-- always get the entry (plan.md 3.2: every support action is logged). Direct inserts are removed.
REVOKE INSERT ON support_grants FROM dhara_admin;
DROP POLICY admin_request ON support_grants;

CREATE FUNCTION admin_request_support(p_chamber uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := app_admin_id();
  v_id uuid := gen_random_uuid();
  v_prev_chamber text := current_setting('app.chamber_id', true);
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (SELECT 1 FROM platform_admins WHERE id = v_admin AND disabled_at IS NULL) THEN
    RAISE EXCEPTION 'no admin context' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 10 OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'reason must be 10 to 1000 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chambers WHERE id = p_chamber) THEN
    RAISE EXCEPTION 'unknown chamber' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.chamber_id', p_chamber::text, true);
  INSERT INTO support_grants (id, chamber_id, admin_id, reason) VALUES (v_id, p_chamber, v_admin, trim(p_reason));
  INSERT INTO audit_log (id, chamber_id, actor_user_id, actor_kind, action, entity, entity_id, fields)
  VALUES (gen_random_uuid(), p_chamber, NULL, 'admin', 'support.request', 'support_grant', v_id::text,
          jsonb_build_object('adminId', v_admin));
  INSERT INTO admin_audit_log (id, admin_id, action, chamber_id, entity, entity_id)
  VALUES (gen_random_uuid(), v_admin, 'support.request', p_chamber, 'support_grant', v_id::text);
  PERFORM set_config('app.chamber_id', coalesce(v_prev_chamber, ''), true);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION admin_request_support(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_request_support(uuid, text) TO dhara_admin;
