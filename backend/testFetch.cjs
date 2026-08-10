fetch('http://localhost:3001/api/logs/audit?limit=1')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error);
