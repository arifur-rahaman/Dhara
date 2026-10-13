/** A plausible email address, trimmed and lower-cased; null when it is not one. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/** "ra•••@gmail.com": enough to recognise one's own address, not to read it out. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}${'•'.repeat(3)}@${domain}`;
}
