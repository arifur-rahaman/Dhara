-- AlterTable
ALTER TABLE "users" ADD COLUMN     "text_size" TEXT;

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_bn" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "summary_bn" TEXT NOT NULL,
    "free" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_bn" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "body_bn" TEXT NOT NULL,
    "video_url" TEXT,
    "minutes" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_progress" (
    "user_id" UUID NOT NULL,
    "module_id" TEXT NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("user_id","module_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_course_id_position_key" ON "course_modules"("course_id", "position");

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE users ADD CONSTRAINT users_text_size_check CHECK (text_size IN ('sm', 'md', 'lg'));
ALTER TABLE course_modules ADD CONSTRAINT course_modules_video_https CHECK (video_url IS NULL OR video_url LIKE 'https://%');

-- F24, F25: course content is the same for everyone and is loaded by the migration owner
-- (scripts/load-courses.mjs). The app can only read it.
GRANT SELECT ON courses, course_modules TO dhara_app;

-- Progress is personal: each person reads and writes only their own rows. No chamber, admin or jobs access.
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY own_progress ON course_progress TO dhara_app USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
GRANT SELECT, INSERT, DELETE ON course_progress TO dhara_app;
