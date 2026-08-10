import mysql from 'mysql2/promise';

const maxAttempts = 30;
const delayMs = 2000;

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nms',
};

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    const conn = await mysql.createConnection(config);
    await conn.ping();
    await conn.end();
    console.log(`[wait-for-db] MySQL ready (attempt ${attempt})`);
    process.exit(0);
  } catch (err) {
    console.log(`[wait-for-db] Waiting for MySQL… (${attempt}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, delayMs));
  }
}

console.error('[wait-for-db] MySQL did not become ready in time');
process.exit(1);
