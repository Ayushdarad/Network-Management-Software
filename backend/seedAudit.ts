import { db } from './src/db/connection.js';
import { auditLogs } from './src/db/schema.js';

async function seed() {
  console.log('Seeding audit logs...');
  await db.insert(auditLogs).values([
    { userName: 'j.garcia', userRole: 'operator', action: 'ACKNOWLEDGE_ALERT', resource: 'ALT-0044', ip: '10.1.3.5', result: 'success' },
    { userName: 'admin', userRole: 'admin', action: 'CONFIG_CHANGE', resource: 'fw-primary', ip: '10.1.3.5', result: 'success' },
    { userName: 'n.okonkwo', userRole: 'operator', action: 'JOB_CREATE', resource: 'JOB-010', ip: '10.1.3.8', result: 'success' },
    { userName: 'j.garcia', userRole: 'operator', action: 'DEVICE_SCAN', resource: '10.20.0.0/24', ip: '10.1.3.5', result: 'success' },
    { userName: 'admin', userRole: 'admin', action: 'USER_LOGIN', resource: 'NMS Portal', ip: '203.0.113.10', result: 'failed' },
    { userName: 'admin', userRole: 'admin', action: 'REPORT_GENERATE', resource: 'SLA-Monthly', ip: '10.1.3.5', result: 'success' },
  ]);
  console.log('Done!');
  process.exit(0);
}

seed().catch(console.error);
