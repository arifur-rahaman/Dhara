-- A device's push endpoint belongs to whoever is signed in on it now. When someone else used the same
-- browser before, their row is invisible to the new person (RLS), so a plain insert would hit the unique key.
CREATE FUNCTION app_claim_push_endpoint(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_user_id() IS NULL THEN RAISE EXCEPTION 'no user' USING ERRCODE = '42501'; END IF;
  IF p_endpoint !~ '^https://' OR length(p_endpoint) > 1000 THEN
    RAISE EXCEPTION 'bad endpoint' USING ERRCODE = '22023';
  END IF;
  DELETE FROM push_subscriptions WHERE endpoint = p_endpoint;
  INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
  VALUES (gen_random_uuid(), app_user_id(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200));
END $$;
REVOKE ALL ON FUNCTION app_claim_push_endpoint(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_claim_push_endpoint(text, text, text, text) TO dhara_app;
CREATE POLICY definer_all ON push_subscriptions USING (app_is_definer()) WITH CHECK (app_is_definer());

CREATE OR REPLACE FUNCTION admin_request_support(p_chamber uuid, p_reason text)
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
  -- The chamber's owners see the request in their notification centre (Notifications design).
  INSERT INTO notifications (id, user_id, chamber_id, kind, payload)
  SELECT gen_random_uuid(), m.user_id, p_chamber, 'support.request', jsonb_build_object('grantId', v_id)
  FROM memberships m WHERE m.chamber_id = p_chamber AND m.role = 'owner' AND m.status = 'active';
  PERFORM set_config('app.chamber_id', coalesce(v_prev_chamber, ''), true);
  RETURN v_id;
END $$;
