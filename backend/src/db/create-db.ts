import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'Ayush@123',
});

await conn.query('CREATE DATABASE IF NOT EXISTS nms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
console.log('✅ Database "nms" created (or already exists)');
await conn.end();
