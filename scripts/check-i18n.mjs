// Fails when bn.json is missing a key from en.json (the source), has extra keys, or has empty values.
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`../src/i18n/${name}.json`, import.meta.url), 'utf8'));

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );
}

const en = new Map(flatten(load('en')));
const bn = new Map(flatten(load('bn')));
const problems = [];

for (const key of en.keys()) if (!bn.has(key)) problems.push(`bn.json is missing "${key}"`);
for (const key of bn.keys()) if (!en.has(key)) problems.push(`bn.json has "${key}", which is not in en.json`);
for (const [file, map] of [
  ['en', en],
  ['bn', bn],
])
  for (const [key, value] of map)
    if (typeof value !== 'string' || value.trim() === '') problems.push(`${file}.json "${key}" is empty`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`i18n: ${en.size} keys, en and bn match.`);
