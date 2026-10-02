-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" UUID NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_attempts_key_hash_created_at_idx" ON "auth_attempts"("key_hash", "created_at");
GRANT SELECT, INSERT, DELETE ON auth_attempts TO dhara_app;
