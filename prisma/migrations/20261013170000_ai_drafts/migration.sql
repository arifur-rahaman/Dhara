-- CreateTable
CREATE TABLE "ai_drafts" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "case_id" UUID,
    "kind" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "redacted_input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "removed_citations" INTEGER NOT NULL DEFAULT 0,
    "redaction_map_enc" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_drafts_chamber_id_created_by_created_at_idx" ON "ai_drafts"("chamber_id", "created_by", "created_at");


ALTER TABLE ai_drafts ADD CONSTRAINT ai_drafts_kind CHECK (kind IN ('plaint', 'bail', 'notice', 'writ'));
ALTER TABLE ai_drafts ADD CONSTRAINT ai_drafts_language CHECK (language IN ('en', 'bn'));
ALTER TABLE ai_drafts ADD CONSTRAINT ai_drafts_case_chamber FOREIGN KEY (case_id, chamber_id) REFERENCES cases (id, chamber_id);

-- P8: owners and associates draft. Each sees their own drafts; the owner sees every draft in the chamber.
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY drafts_read ON ai_drafts FOR SELECT TO dhara_app
  USING (chamber_id = app_chamber_id() AND (created_by = app_user_id() OR app_is_owner()));
CREATE POLICY drafts_write ON ai_drafts FOR INSERT TO dhara_app
  WITH CHECK (chamber_id = app_chamber_id() AND created_by = app_user_id() AND app_role() IN ('owner', 'associate'));
CREATE POLICY drafts_delete ON ai_drafts FOR UPDATE TO dhara_app
  USING (chamber_id = app_chamber_id() AND (created_by = app_user_id() OR app_is_owner()))
  WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON ai_drafts TO dhara_app;
