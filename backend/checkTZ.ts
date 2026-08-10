import { db } from './src/db/connection.js';
import { sql } from 'drizzle-orm';
async function main() {
  const [res] = await db.execute(sql`SELECT NOW(), @@system_time_zone, @@global.time_zone, @@session.time_zone`);
  console.log(res);
  process.exit(0);
}
main();
