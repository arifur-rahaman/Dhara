-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('order', 'pleading', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('pending', 'ready');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bkash', 'nagad', 'bank', 'gateway');

-- AlterTable
ALTER TABLE "chambers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "receipt_seq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "confidential" BOOLEAN NOT NULL DEFAULT false,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "uploaded_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fees" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_poisha" INTEGER NOT NULL,
    "charged_on" DATE NOT NULL,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "client_id" UUID,
    "amount_poisha" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "paid_on" DATE NOT NULL,
    "receipt_no" INTEGER NOT NULL,
    "received_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_chamber_id_case_id_idx" ON "documents"("chamber_id", "case_id");

-- CreateIndex
CREATE INDEX "fees_chamber_id_case_id_idx" ON "fees"("chamber_id", "case_id");

-- CreateIndex
CREATE INDEX "payments_chamber_id_paid_on_idx" ON "payments"("chamber_id", "paid_on");

-- CreateIndex
CREATE INDEX "payments_chamber_id_case_id_idx" ON "payments"("chamber_id", "case_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_chamber_id_receipt_no_key" ON "payments"("chamber_id", "receipt_no");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_chamber_fkey" FOREIGN KEY ("case_id", "chamber_id") REFERENCES "cases"("id", "chamber_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fees" ADD CONSTRAINT "fees_case_chamber_fkey" FOREIGN KEY ("case_id", "chamber_id") REFERENCES "cases"("id", "chamber_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_case_chamber_fkey" FOREIGN KEY ("case_id", "chamber_id") REFERENCES "cases"("id", "chamber_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_chamber_fkey" FOREIGN KEY ("client_id", "chamber_id") REFERENCES "clients"("id", "chamber_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- M4: documents (P5, P6) and money (P9) at the database level (TECH_GUIDE section 4).
-- Visibility comes from the caller's own active membership, not from a flag the app passes in.
-- ---------------------------------------------------------------------------
ALTER TABLE fees ADD CONSTRAINT fees_amount_positive CHECK (amount_poisha > 0);
ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount_poisha > 0);
ALTER TABLE payments ADD CONSTRAINT payments_receipt_positive CHECK (receipt_no > 0);
ALTER TABLE documents ADD CONSTRAINT documents_size_positive CHECK (size_bytes > 0);

-- The active membership of app.user_id in app.chamber_id (at most one row).
CREATE FUNCTION app_membership() RETURNS TABLE (id uuid, role "Role", case_scope "CaseScope", can_see_fees boolean)
LANGUAGE sql STABLE AS $$
  SELECT m.id, m.role, m.case_scope, m.can_see_fees FROM memberships m
  WHERE m.chamber_id = app_chamber_id() AND m.user_id = app_user_id() AND m.status = 'active'
$$;

-- P9: owner always; an associate only when the owner turned fees on for them.
CREATE FUNCTION app_can_see_fees() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT role = 'owner' OR (role = 'associate' AND can_see_fees) FROM app_membership()), false)
$$;

CREATE FUNCTION app_is_owner() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT role = 'owner' FROM app_membership()), false)
$$;

-- P5 and P6 for one document row: owner all; associate per case scope; munshi orders only; staff none;
-- confidential only for the uploader and the owner.
CREATE FUNCTION app_can_see_document(p_case uuid, p_kind "DocumentKind", p_confidential boolean, p_uploaded_by uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((
    SELECT
      (NOT p_confidential OR p_uploaded_by = app_user_id() OR m.role = 'owner')
      AND CASE m.role
        WHEN 'owner' THEN true
        WHEN 'associate' THEN m.case_scope = 'all'
          OR EXISTS (SELECT 1 FROM cases k WHERE k.id = p_case AND k.assignee_membership_id = m.id)
        WHEN 'munshi' THEN p_kind = 'order'
        ELSE false
      END
    FROM app_membership() m
  ), false)
$$;

GRANT EXECUTE ON FUNCTION app_membership(), app_can_see_fees(), app_is_owner(),
  app_can_see_document(uuid, "DocumentKind", boolean, uuid) TO dhara_app;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY document_read ON documents FOR SELECT
  USING (chamber_id = app_chamber_id() AND app_can_see_document(case_id, kind, confidential, uploaded_by));
CREATE POLICY document_upload ON documents FOR INSERT
  WITH CHECK (chamber_id = app_chamber_id() AND uploaded_by = app_user_id()
              AND app_can_see_document(case_id, kind, confidential, uploaded_by));
-- Finishing an upload, renaming or removing: the uploader or the owner.
CREATE POLICY document_change ON documents FOR UPDATE
  USING (chamber_id = app_chamber_id() AND (uploaded_by = app_user_id() OR app_is_owner()))
  WITH CHECK (chamber_id = app_chamber_id() AND app_can_see_document(case_id, kind, confidential, uploaded_by));
GRANT SELECT, INSERT ON documents TO dhara_app;
GRANT UPDATE (title, kind, confidential, status, size_bytes, deleted_at, updated_at) ON documents TO dhara_app;

ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees FORCE ROW LEVEL SECURITY;
CREATE POLICY fee_read ON fees FOR SELECT USING (chamber_id = app_chamber_id() AND app_can_see_fees());
CREATE POLICY fee_write ON fees FOR INSERT WITH CHECK (chamber_id = app_chamber_id() AND app_is_owner());
CREATE POLICY fee_change ON fees FOR UPDATE USING (chamber_id = app_chamber_id() AND app_is_owner())
  WITH CHECK (chamber_id = app_chamber_id() AND app_is_owner());
GRANT SELECT, INSERT ON fees TO dhara_app;
GRANT UPDATE (description, amount_poisha, charged_on, deleted_at, updated_at) ON fees TO dhara_app;

-- Payments are append-only: a receipt, once issued, is never edited.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_read ON payments FOR SELECT USING (chamber_id = app_chamber_id() AND app_can_see_fees());
CREATE POLICY payment_write ON payments FOR INSERT
  WITH CHECK (chamber_id = app_chamber_id() AND app_is_owner() AND received_by = app_user_id());
GRANT SELECT, INSERT ON payments TO dhara_app;

-- The admin role gets nothing on these tables (TECH_GUIDE section 6), and no new chamber columns.
