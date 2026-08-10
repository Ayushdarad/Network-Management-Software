const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Ayush@123', database: 'nms'
  });

  console.log('Creating assets table...');
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS assets (
        id varchar(20) NOT NULL PRIMARY KEY,
        name varchar(150) NOT NULL,
        owner varchar(100) NOT NULL,
        status enum('active','review','expired') NOT NULL DEFAULT 'review',
        category varchar(50) NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Table assets created successfully.');
  } catch (err) {
    console.error('Error creating assets table:', err.message);
  }
  await conn.end();
}

run().catch(console.error);
