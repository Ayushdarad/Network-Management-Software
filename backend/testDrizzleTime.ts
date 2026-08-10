import { db } from './src/db/connection.js';
import { auditLogs } from './src/db/schema.js';
import { desc } from 'drizzle-orm';

async function run() {
  const [row] = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(1);
  console.log('Raw from drizzle:', row.createdAt);
  console.log('Is Date?', row.createdAt instanceof Date);
  if (row.createdAt instanceof Date) {
    console.log('ISO:', row.createdAt.toISOString());
    console.log('Local:', row.createdAt.toString());
  }
  process.exit(0);
}

run().catch(console.error);
