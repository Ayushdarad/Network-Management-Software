import { db } from './src/db/connection.js';
import { auditLogs } from './src/db/schema.js';
import { desc } from 'drizzle-orm';

async function main() {
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(2);
  console.log(logs.map(l => ({
    id: l.id,
    rawStr: String(l.createdAt),
    iso: l.createdAt.toISOString(),
    getTime: l.createdAt.getTime()
  })));
  process.exit(0);
}
main();
