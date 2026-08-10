const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Ayush@123', database: 'nms'
  });

  console.log('Creating device_timeline table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS device_timeline (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      device_id     VARCHAR(10)   NOT NULL,
      hostname      VARCHAR(100)  NOT NULL,
      state         ENUM('online','offline') NOT NULL,
      started_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at      TIMESTAMP     NULL,
      duration_secs INT           NULL,
      summary       VARCHAR(255)  NULL,
      INDEX idx_timeline_device  (device_id),
      INDEX idx_timeline_started (started_at),
      INDEX idx_timeline_ended   (ended_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('device_timeline table created successfully.');
  await conn.end();
}

run().catch(console.error);
