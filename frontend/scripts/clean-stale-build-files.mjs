import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

const stalePaths = [
  'auth.ts',
  'lib/admin.ts',
  'lib/db.ts',
  'lib/permissions.ts',
  'lib/sanitize.ts',
  'lib/storage.ts',
  'lib/jobs.ts',
  'lib/meta.ts',
  'lib/order.ts',
  'lib/rate-limit.ts',
  'lib/security.ts',
  'lib/postex.ts',
  'lib/email.ts',
  'app/api/auth',
  'app/api/admin',
  'app/api/checkout',
  'app/api/events',
  'app/api/health',
  'app/api/orders',
  'app/api/reviews',
  'app/feeds/meta.xml',
];

let removed = 0;
for (const relative of stalePaths) {
  const target = resolve(root, relative);
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  removed += 1;
  console.log(`[prebuild] removed stale legacy path: ${relative}`);
}

console.log(`[prebuild] clean frontend ready (${removed} stale path${removed === 1 ? '' : 's'} removed).`);
console.log('[prebuild] .next is intentionally left to Next.js; this avoids Windows ENOTEMPTY/EPERM failures.');
