-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_verified_at" TIMESTAMPTZ;


-- Until now every sign-in was by SMS code, so existing people proved their phone.
UPDATE users SET phone_verified_at = created_at;
