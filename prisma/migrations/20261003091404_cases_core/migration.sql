-- CreateEnum
CREATE TYPE "CourtLevel" AS ENUM ('supreme', 'district', 'tribunal');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('civil', 'criminal_cr', 'criminal_gr', 'writ', 'family', 'money_loan', 'other');

-- CreateEnum
CREATE TYPE "OurSide" AS ENUM ('plaintiff', 'defendant');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('active', 'disposed');

-- CreateEnum
CREATE TYPE "HearingSource" AS ENUM ('manual', 'photo_ai', 'court_sync');

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL,
    "chamber_id" UUID,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "level" "CourtLevel" NOT NULL,
    "district" TEXT,
    "official_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "client_id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "phone_enc" TEXT,
    "email_enc" TEXT,
    "nid_enc" TEXT,
    "address_enc" TEXT,
    "consent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("client_id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "type" "CaseType" NOT NULL,
    "number" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "court_id" UUID NOT NULL,
    "court_no" TEXT,
    "our_side" "OurSide" NOT NULL,
    "client_id" UUID,
    "parties_text" TEXT,
    "opposing_counsel" TEXT,
    "note" TEXT,
    "assignee_membership_id" UUID,
    "status" "CaseStatus" NOT NULL DEFAULT 'active',
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hearings" (
    "id" UUID NOT NULL,
    "chamber_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "serial_or_item" TEXT,
    "purpose" TEXT,
    "outcome_note" TEXT,
    "source" "HearingSource" NOT NULL DEFAULT 'manual',
    "added_by" UUID NOT NULL,
    "source_url" TEXT,
    "fetched_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hearings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courts_district_idx" ON "courts"("district");

-- CreateIndex
CREATE INDEX "courts_chamber_id_idx" ON "courts"("chamber_id");

-- CreateIndex
CREATE INDEX "clients_chamber_id_idx" ON "clients"("chamber_id");

-- CreateIndex
CREATE INDEX "client_contacts_chamber_id_idx" ON "client_contacts"("chamber_id");

-- CreateIndex
CREATE INDEX "cases_chamber_id_idx" ON "cases"("chamber_id");

-- CreateIndex
CREATE INDEX "cases_chamber_id_assignee_membership_id_idx" ON "cases"("chamber_id", "assignee_membership_id");

-- CreateIndex
CREATE INDEX "hearings_chamber_id_date_idx" ON "hearings"("chamber_id", "date");

-- CreateIndex
CREATE INDEX "hearings_case_id_date_idx" ON "hearings"("case_id", "date");

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Row-level security for M2 tables (TECH_GUIDE section 4).
-- ---------------------------------------------------------------------------

-- Role of the signed-in membership, set per transaction by withTenant(). Used as a second lock on client contact.
CREATE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.role', true), '') $$;
GRANT EXECUTE ON FUNCTION app_role() TO dhara_app;

-- courts: the shared directory plus the current chamber's own courts. The app may add only chamber courts.
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts FORCE ROW LEVEL SECURITY;
CREATE POLICY directory_or_tenant ON courts
  USING (chamber_id IS NULL OR chamber_id = app_chamber_id())
  WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON courts TO dhara_app;

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clients
  USING (chamber_id = app_chamber_id()) WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON clients TO dhara_app;

-- client_contacts (P1): only inside the chamber AND only when the request runs as the owner.
-- The app also never selects these columns for other roles; this policy is the database-level backstop.
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON client_contacts
  USING (chamber_id = app_chamber_id() AND app_role() = 'owner')
  WITH CHECK (chamber_id = app_chamber_id() AND app_role() = 'owner');
GRANT SELECT, INSERT, UPDATE ON client_contacts TO dhara_app;

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cases
  USING (chamber_id = app_chamber_id()) WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON cases TO dhara_app;

ALTER TABLE hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hearings
  USING (chamber_id = app_chamber_id()) WITH CHECK (chamber_id = app_chamber_id());
GRANT SELECT, INSERT, UPDATE ON hearings TO dhara_app;

-- Rows must reference parents in the same chamber (composite keys; declared in schema.prisma too).
CREATE UNIQUE INDEX cases_id_chamber_idx ON cases (id, chamber_id);
ALTER TABLE hearings ADD CONSTRAINT hearings_case_chamber_fkey
  FOREIGN KEY (case_id, chamber_id) REFERENCES cases (id, chamber_id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX clients_id_chamber_idx ON clients (id, chamber_id);
ALTER TABLE client_contacts ADD CONSTRAINT client_contacts_client_chamber_fkey
  FOREIGN KEY (client_id, chamber_id) REFERENCES clients (id, chamber_id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE cases ADD CONSTRAINT cases_client_chamber_fkey
  FOREIGN KEY (client_id, chamber_id) REFERENCES clients (id, chamber_id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- The directory seed runs as the table owner, which FORCE ROW LEVEL SECURITY would otherwise block
-- when that owner is not a superuser (as on managed databases).
ALTER TABLE courts NO FORCE ROW LEVEL SECURITY;
-- ---------------------------------------------------------------------------
-- Court directory (F2). Generic court types per district; numbered courts (e.g. "-2") are entered on the case.
-- Names follow common usage and must be checked against official records (plan.md section 12).
-- ---------------------------------------------------------------------------
INSERT INTO courts (id, name_bn, name_en, level, district, official_url, updated_at) VALUES
  (gen_random_uuid(), 'আপিল বিভাগ', 'Appellate Division', 'supreme', NULL, 'https://www.supremecourt.gov.bd', now()),
  (gen_random_uuid(), 'হাইকোর্ট বিভাগ', 'High Court Division', 'supreme', NULL, 'https://www.supremecourt.gov.bd', now()),
  (gen_random_uuid(), 'চিফ মেট্রোপলিটন ম্যাজিস্ট্রেট আদালত', 'Chief Metropolitan Magistrate Court', 'district', 'Dhaka', NULL, now()),
  (gen_random_uuid(), 'চিফ মেট্রোপলিটন ম্যাজিস্ট্রেট আদালত', 'Chief Metropolitan Magistrate Court', 'district', 'Chattogram', NULL, now());

INSERT INTO courts (id, name_bn, name_en, level, district, updated_at)
SELECT gen_random_uuid(), t.name_bn, t.name_en, t.level::"CourtLevel", d.district, now()
FROM unnest(ARRAY[
  'Bagerhat','Bandarban','Barguna','Barishal','Bhola','Bogura','Brahmanbaria','Chandpur','Chapainawabganj',
  'Chattogram','Chuadanga','Cumilla','Cox''s Bazar','Dhaka','Dinajpur','Faridpur','Feni','Gaibandha','Gazipur',
  'Gopalganj','Habiganj','Jamalpur','Jashore','Jhalokati','Jhenaidah','Joypurhat','Khagrachhari','Khulna',
  'Kishoreganj','Kurigram','Kushtia','Lakshmipur','Lalmonirhat','Madaripur','Magura','Manikganj','Meherpur',
  'Moulvibazar','Munshiganj','Mymensingh','Naogaon','Narail','Narayanganj','Narsingdi','Natore','Netrokona',
  'Nilphamari','Noakhali','Pabna','Panchagarh','Patuakhali','Pirojpur','Rajbari','Rajshahi','Rangamati','Rangpur',
  'Satkhira','Shariatpur','Sherpur','Sirajganj','Sunamganj','Sylhet','Tangail','Thakurgaon'
]) AS d(district)
CROSS JOIN (VALUES
  (1, 'জেলা ও দায়রা জজ আদালত', 'District and Sessions Judge Court', 'district'),
  (2, 'অতিরিক্ত জেলা ও দায়রা জজ আদালত', 'Additional District and Sessions Judge Court', 'district'),
  (3, 'যুগ্ম জেলা জজ আদালত', 'Joint District Judge Court', 'district'),
  (4, 'সিনিয়র সহকারী জজ আদালত', 'Senior Assistant Judge Court', 'district'),
  (5, 'সহকারী জজ আদালত', 'Assistant Judge Court', 'district'),
  (6, 'চিফ জুডিশিয়াল ম্যাজিস্ট্রেট আদালত', 'Chief Judicial Magistrate Court', 'district'),
  (7, 'পারিবারিক আদালত', 'Family Court', 'district'),
  (8, 'অর্থঋণ আদালত', 'Artha Rin Adalat (Money Loan Court)', 'district'),
  (9, 'নারী ও শিশু নির্যাতন দমন ট্রাইব্যুনাল', 'Nari o Shishu Nirjatan Daman Tribunal', 'tribunal')
) AS t(sort, name_bn, name_en, level);
ALTER TABLE courts FORCE ROW LEVEL SECURITY;
