import { testDb } from './test-env';

// Server modules read these when first imported.
process.env.DATABASE_URL = testDb.appUrl;
process.env.DATABASE_ADMIN_URL = testDb.adminUrl;
process.env.SESSION_SECRET ??= 'test-session-secret-test-session-secret-0000';
process.env.FIELD_ENCRYPTION_KEYS ??= JSON.stringify({ v1: Buffer.alloc(32, 7).toString('base64') });
process.env.FIELD_ENCRYPTION_ACTIVE ??= 'v1';
