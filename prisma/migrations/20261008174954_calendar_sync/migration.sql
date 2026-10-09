-- CreateTable
CREATE TABLE "calendar_links" (
    "user_id" UUID NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "calendar_links_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "user_id" UUID NOT NULL,
    "hearing_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("user_id","hearing_id")
);


-- F8: each person sees and changes only their own calendar link and event map. No other role has access.
ALTER TABLE calendar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_links FORCE ROW LEVEL SECURITY;
CREATE POLICY own_link ON calendar_links TO dhara_app USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_links TO dhara_app;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events FORCE ROW LEVEL SECURITY;
CREATE POLICY own_events ON calendar_events TO dhara_app USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_events TO dhara_app;
