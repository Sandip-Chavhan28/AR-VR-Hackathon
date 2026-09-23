const http = require('http');

http.get('http://localhost:5173', (res) => {
  console.log('HTTP Status:', res.statusCode);
  process.exit(0);
}).on('error', (e) => {
  console.log('Error:', e.message);
  process.exit(1);
});
