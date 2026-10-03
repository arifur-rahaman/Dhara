-- Support access never lasts longer than 24 hours from approval (plan.md 3.2), whatever the app sends.
ALTER TABLE support_grants ADD CONSTRAINT support_grants_window
  CHECK (expires_at IS NULL OR (approved_at IS NOT NULL AND expires_at <= approved_at + interval '24 hours'));
