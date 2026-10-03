const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are UUIDs; anything else is "not found" before it reaches the database. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
