// Creates a platform admin (plan.md 3.2). Admins are never created from the portal itself.
// Runs as the migration role, prints a one-time password and the authenticator setup once.
// Usage: node --env-file=.env scripts/admin-create.mjs --phone 01712345678 --name "Name" [--role support|super_admin]
//        node --env-file=.env scripts/admin-create.mjs --disable --phone 01712345678
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { hash } from '@node-rs/argon2';
import { generateSecret, generateURI } from 'otplib';
import pg from 'pg';
import QRCode from 'qrcode';

const { values: args } = parseArgs({
  options: {
    phone: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'support' },
    disable: { type: 'boolean', default: false },
  },
});

function normalizeBdPhone(input = '') {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('880') ? digits.slice(2) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? `+88${local}` : null;
}

// Same format as src/server/crypto encryptField: version:iv:ciphertext:tag (base64), AES-256-GCM.
function encryptField(plain) {
  const keys = JSON.parse(process.env.FIELD_ENCRYPTION_KEYS ?? '{}');
  const active = process.env.FIELD_ENCRYPTION_ACTIVE;
  const key = active && keys[active] ? Buffer.from(keys[active], 'base64') : null;
  if (!key || key.length !== 32)
    throw new Error('FIELD_ENCRYPTION_KEYS / FIELD_ENCRYPTION_ACTIVE are not set correctly');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [active, iv.toString('base64'), data.toString('base64'), cipher.getAuthTag().toString('base64')].join(':');
}

const phone = normalizeBdPhone(args.phone);
if (!phone) throw new Error('--phone must be a Bangladeshi mobile number');
if (!process.env.DATABASE_MIGRATE_URL) throw new Error('DATABASE_MIGRATE_URL is not set');

const db = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await db.connect();
try {
  if (args.disable) {
    const r = await db.query(`UPDATE platform_admins SET disabled_at = now(), updated_at = now() WHERE phone = $1`, [
      phone,
    ]);
    await db.query(
      `UPDATE admin_sessions SET revoked_at = now() WHERE revoked_at IS NULL AND admin_id IN (SELECT id FROM platform_admins WHERE phone = $1)`,
      [phone],
    );
    console.log(r.rowCount ? 'Admin turned off and signed out.' : 'No admin with that phone.');
  } else {
    if (!args.name || args.name.trim().length < 2) throw new Error('--name is required');
    if (!['support', 'super_admin'].includes(args.role)) throw new Error('--role must be support or super_admin');
    const password = randomBytes(15).toString('base64url');
    const secret = generateSecret();
    const id = randomUUID();
    await db.query(
      `INSERT INTO platform_admins (id, phone, name, role, password_hash, totp_secret_enc, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [
        id,
        phone,
        args.name.trim(),
        args.role,
        await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        encryptField(secret),
      ],
    );
    await db.query(
      `INSERT INTO admin_audit_log (id, admin_id, action, entity, entity_id) VALUES ($1, NULL, 'admin.create', 'admin', $2)`,
      [randomUUID(), id],
    );
    const uri = generateURI({ issuer: 'Dhara Admin', label: phone, secret });
    console.log(`Admin created: ${args.name.trim()} (${args.role})`);
    console.log(`Password (shown once; hand it over in person): ${password}`);
    console.log('Scan this in their authenticator app:');
    console.log(await QRCode.toString(uri, { type: 'terminal', small: true }));
    console.log(`Or enter this setup key: ${secret}`);
  }
} finally {
  await db.end();
}
