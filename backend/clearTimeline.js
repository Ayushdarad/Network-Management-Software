import mysql from 'mysql2/promise';

async function main() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'nms_db',
  });
  await pool.query('TRUNCATE TABLE device_timeline');
  console.log('Timeline cleared');
  process.exit(0);
}

main().catch(console.error);
