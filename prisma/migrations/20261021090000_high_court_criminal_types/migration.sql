-- High Court Division criminal matters (Code of Criminal Procedure sections 498, 426, 561A, appeals and revisions).
ALTER TYPE "CaseType" ADD VALUE 'criminal_appeal' AFTER 'criminal_gr';
ALTER TYPE "CaseType" ADD VALUE 'criminal_498' AFTER 'criminal_appeal';
ALTER TYPE "CaseType" ADD VALUE 'criminal_revision' AFTER 'criminal_498';
ALTER TYPE "CaseType" ADD VALUE 'criminal_426' AFTER 'criminal_revision';
ALTER TYPE "CaseType" ADD VALUE 'criminal_561a' AFTER 'criminal_426';
