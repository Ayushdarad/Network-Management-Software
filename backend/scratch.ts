import { db } from './src/db/connection.js';
import { devices } from './src/db/schema.js';

async function run() {
  try {
    await db.insert(devices).values({
      id: 'SRV-9999',
      hostname: 'user-server',
      ip: '192.168.10.10',
      type: 'server',
      vendor: 'Generic',
      model: 'Custom Build',
      location: 'Local',
      site: 'HQ',
      status: 'online',
      os: 'Linux',
      uptime: '0d 0h',
      cpu: 10,
      memory: 20,
      disk: 15,
      interfaces: 2,
      tags: ['user-added']
    });
    console.log("Device added successfully!");
  } catch (err) {
    console.error("Error inserting device:", err);
  } finally {
    process.exit(0);
  }
}

run();
