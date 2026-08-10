const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Ayush@123', database: 'nms'
  });

  console.log('Adding total_polls and online_polls columns...');
  try {
    await conn.execute('ALTER TABLE devices ADD COLUMN total_polls INT NOT NULL DEFAULT 0');
  } catch (err) { console.log('total_polls already exists or error:', err.message); }
  try {
    await conn.execute('ALTER TABLE devices ADD COLUMN online_polls INT NOT NULL DEFAULT 0');
  } catch (err) { console.log('online_polls already exists or error:', err.message); }
  console.log('Columns added successfully.');
  await conn.end();
}

run().catch(console.error);
