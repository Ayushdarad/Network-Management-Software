import 'dotenv/config';
import { db } from '../src/db/connection.ts';
import { devices } from '../src/db/schema.ts';
import {
  dedupeOpenTimelineSegments,
  dedupeClosedTimelineSegments,
  repairOverlappingTimelineSegments,
} from '../src/lib/timelineSegments.ts';

const deviceList = await db.select({ id: devices.id, hostname: devices.hostname }).from(devices);
console.log(`Repairing timeline overlaps for ${deviceList.length} device(s)…`);

for (const d of deviceList) {
  await dedupeOpenTimelineSegments(d.id);
  await dedupeClosedTimelineSegments(d.id);
  await repairOverlappingTimelineSegments(d.id);
  console.log(`  ✓ ${d.hostname} (${d.id})`);
}

console.log('Done.');
process.exit(0);
