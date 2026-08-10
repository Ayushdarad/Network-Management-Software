import mysql from 'mysql2/promise';

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nms_db',
  });

  const [rows] = await pool.query('SELECT * FROM device_timeline ORDER BY id DESC LIMIT 10');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

main().catch(console.error);
