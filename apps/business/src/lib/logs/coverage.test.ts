import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every exported mutation of a server action file must be logged (docs/APP-LOGS.md):
 * its body lives in `<name>Unlogged` and the export wraps it with `loggedAction`
 * (or `withLoggedAction`). Reads (get…, list…, search…) are only logged on server errors.
 */
const ACTIONS_DIR = path.resolve(__dirname, '../../app/_actions');
const READ = /^(get|list|search|fetch|load|count|preview|generate|check)[A-Z]/;
const READS_THAT_WRITE = new Set(['getOrCreateWeek']);
const EXPORT = /^export async function (\w+)\(/gm;

function serverActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return serverActionFiles(full);
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) return [];
    return readFileSync(full, 'utf8').trimStart().startsWith("'use server'") ? [full] : [];
  });
}

describe('server action logging coverage', () => {
  it('wraps every exported mutation', () => {
    const missing: string[] = [];
    for (const file of serverActionFiles(ACTIONS_DIR)) {
      const source = readFileSync(file, 'utf8');
      for (const [, name] of source.matchAll(EXPORT)) {
        const isRead = READ.test(name) && !READS_THAT_WRITE.has(name);
        if (isRead || name === 'listAppLogs') continue;
        const wrapped =
          source.includes(`async function ${name}Unlogged(`) &&
          /loggedAction\(|withLoggedAction\(/.test(source);
        if (!wrapped) missing.push(`${path.relative(ACTIONS_DIR, file)}: ${name}`);
      }
    }
    expect(missing, 'mutations without logging (see docs/APP-LOGS.md)').toEqual([]);
  });
});
