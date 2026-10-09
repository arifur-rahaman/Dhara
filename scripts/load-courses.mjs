// Loads the learning content (F24, F25) from content/courses.json into courses and course_modules.
// Runs as the migration role, after migrations; the app role can only read these tables.
// Courses and modules are matched by id, so progress survives edits. A module dropped from the file is
// removed together with its progress; a course dropped from the file is unpublished, not deleted.
// Usage: node --env-file=.env scripts/load-courses.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';

const file = new URL('../content/courses.json', import.meta.url);
const { courses } = JSON.parse(readFileSync(file, 'utf8'));

const text = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is missing`);
  return value.trim();
};

const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  for (const [courseIndex, course] of courses.entries()) {
    const id = text(course.id, 'course id');
    await client.query(
      `INSERT INTO courses (id, title_en, title_bn, summary_en, summary_bn, free, position, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, now())
       ON CONFLICT (id) DO UPDATE SET title_en = $2, title_bn = $3, summary_en = $4, summary_bn = $5, free = $6,
         position = $7, published = true, updated_at = now()`,
      [
        id,
        text(course.titleEn, `${id} titleEn`),
        text(course.titleBn, `${id} titleBn`),
        text(course.summaryEn, `${id} summaryEn`),
        text(course.summaryBn, `${id} summaryBn`),
        course.free !== false,
        course.position ?? courseIndex,
      ],
    );
    const ids = course.modules.map((m) => text(m.id, `${id} module id`));
    await client.query('DELETE FROM course_modules WHERE course_id = $1 AND NOT (id = ANY($2::text[]))', [id, ids]);
    // Positions are unique per course; move them out of the way first so modules can be reordered.
    await client.query('UPDATE course_modules SET position = -position - 1 WHERE course_id = $1', [id]);
    for (const [position, m] of course.modules.entries()) {
      const videoUrl = m.videoUrl ? text(m.videoUrl, `${m.id} videoUrl`) : null;
      if (videoUrl && !videoUrl.startsWith('https://')) throw new Error(`${m.id} videoUrl must start with https://`);
      await client.query(
        `INSERT INTO course_modules (id, course_id, position, title_en, title_bn, body_en, body_bn, video_url, minutes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (id) DO UPDATE SET course_id = $2, position = $3, title_en = $4, title_bn = $5, body_en = $6,
           body_bn = $7, video_url = $8, minutes = $9, updated_at = now()`,
        [
          m.id,
          id,
          position + 1,
          text(m.titleEn, `${m.id} titleEn`),
          text(m.titleBn, `${m.id} titleBn`),
          text(m.bodyEn, `${m.id} bodyEn`),
          text(m.bodyBn, `${m.id} bodyBn`),
          videoUrl,
          Number.isInteger(m.minutes) ? m.minutes : null,
        ],
      );
    }
  }
  await client.query('UPDATE courses SET published = false WHERE NOT (id = ANY($1::text[]))', [
    courses.map((c) => c.id),
  ]);
  await client.query('COMMIT');
  console.log(`courses: ${courses.length} loaded`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
