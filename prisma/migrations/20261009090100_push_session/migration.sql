-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN     "session_id" UUID;

-- CreateIndex
CREATE INDEX "push_subscriptions_session_id_idx" ON "push_subscriptions"("session_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Remote sign-out (Settings, devices) also forgets that device's push subscription.
-- The server passes the current session id; the function checks it belongs to the person.
DROP FUNCTION app_claim_push_endpoint(text, text, text, text);
CREATE FUNCTION app_claim_push_endpoint(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_user_id() IS NULL THEN RAISE EXCEPTION 'no user' USING ERRCODE = '42501'; END IF;
  IF p_endpoint !~ '^https://' OR length(p_endpoint) > 1000 THEN
    RAISE EXCEPTION 'bad endpoint' USING ERRCODE = '22023';
  END IF;
  IF p_session IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session AND user_id = app_user_id()) THEN
    RAISE EXCEPTION 'bad session' USING ERRCODE = '42501';
  END IF;
  DELETE FROM push_subscriptions WHERE endpoint = p_endpoint;
  INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, session_id)
  VALUES (gen_random_uuid(), app_user_id(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200), p_session);
END $$;
REVOKE ALL ON FUNCTION app_claim_push_endpoint(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_claim_push_endpoint(text, text, text, text, uuid) TO dhara_app;
