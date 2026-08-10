const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Ayush@123', database: 'nms'
  });

  console.log('Deleting dummy data...');
  await conn.execute(`
    DELETE FROM audit_logs 
    WHERE user_name IN ('j.garcia', 'admin', 'n.okonkwo')
  `);

  console.log('Dummy data deleted.');
  await conn.end();
}

run().catch(console.error);
