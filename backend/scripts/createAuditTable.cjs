const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Ayush@123', database: 'nms'
  });

  console.log('Creating audit_logs table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT,
      user_name  VARCHAR(100),
      user_role  VARCHAR(50),
      action     VARCHAR(100) NOT NULL,
      resource   VARCHAR(200),
      method     VARCHAR(10),
      path       VARCHAR(255),
      ip         VARCHAR(45),
      result     ENUM('success','failed') NOT NULL DEFAULT 'success',
      detail     TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_created (created_at)
    )
  `);

  console.log('audit_logs table ready.');
  await conn.end();
}

run().catch(console.error);
