const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Ayush@123', database: 'nms'
  });

  // Delete mock devices (IDs D001-D020 pattern), keep real ones
  const mockIds = [
    'D001','D002','D003','D004','D005','D006','D007','D008','D009','D010',
    'D011','D012','D013','D014','D015','D016','D017','D018','D019','D020'
  ];

  const placeholders = mockIds.map(() => '?').join(',');
  const [result] = await conn.execute(
    `DELETE FROM devices WHERE id IN (${placeholders})`,
    mockIds
  );
  console.log(`Deleted ${result.affectedRows} mock device(s).`);

  // Also clean up orphaned mock alerts for those devices
  const [alertResult] = await conn.execute(
    `DELETE FROM alerts WHERE device_ip LIKE '10.%' OR device_ip LIKE '192.168.1.%' OR device_ip LIKE '192.168.2.%'`
  );
  console.log(`Cleaned up ${alertResult.affectedRows} associated mock alert(s).`);

  // Also clean up orphaned mock logs
  const [logResult] = await conn.execute(
    `DELETE FROM logs WHERE source_ip LIKE '10.%' OR source_ip LIKE '192.168.1.%' OR source_ip LIKE '192.168.2.%'`
  );
  console.log(`Cleaned up ${logResult.affectedRows} associated mock log(s).`);

  const [remaining] = await conn.execute('SELECT id, hostname, ip, status FROM devices');
  console.log('\nRemaining devices:');
  remaining.forEach(d => console.log(` - ${d.id}  ${d.hostname}  ${d.ip}  [${d.status}]`));

  await conn.end();
}

run().catch(console.error);
