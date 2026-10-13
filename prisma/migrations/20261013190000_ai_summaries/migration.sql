-- DropForeignKey
ALTER TABLE "ai_drafts" DROP CONSTRAINT "ai_drafts_case_chamber";

-- CreateTable
CREATE TABLE "ai_summaries" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_summaries_document_id_created_at_idx" ON "ai_summaries"("document_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_case_chamber" FOREIGN KEY ("case_id", "chamber_id") REFERENCES "cases"("id", "chamber_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE ai_summaries ADD CONSTRAINT ai_summaries_language CHECK (language IN ('en', 'bn'));

-- Visible exactly when the document is (the documents policy applies inside the subquery; P5, P6).
-- Written by owners and associates (P8) of the chamber.
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries FORCE ROW LEVEL SECURITY;
CREATE POLICY summaries_read ON ai_summaries FOR SELECT TO dhara_app
  USING (chamber_id = app_chamber_id() AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id));
CREATE POLICY summaries_write ON ai_summaries FOR INSERT TO dhara_app
  WITH CHECK (chamber_id = app_chamber_id() AND created_by = app_user_id() AND app_role() IN ('owner', 'associate')
              AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id));
GRANT SELECT, INSERT ON ai_summaries TO dhara_app;
