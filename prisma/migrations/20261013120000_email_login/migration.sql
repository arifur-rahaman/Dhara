-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT,
ADD COLUMN     "email_verified_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "otp_challenges_email_created_at_idx" ON "otp_challenges"("email", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");


ALTER TABLE users ADD CONSTRAINT users_email_lower CHECK (email = lower(email) AND length(email) <= 254);
