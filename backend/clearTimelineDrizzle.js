import { db } from './src/db/connection.js';
import { deviceTimeline } from './src/db/schema.js';

async function main() {
  await db.delete(deviceTimeline);
  console.log('Timeline cleared successfully!');
  process.exit(0);
}

main().catch(console.error);
