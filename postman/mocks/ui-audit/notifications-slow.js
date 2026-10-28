const http = require('http');
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = new URL(req.url, 'http://localhost').pathname;
  const reply = () => {
    res.writeHead(path === '/v1/notifications' || path === '/v1/tasks/assigned' ? 200 : 501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
  };
  if (path !== '/v1/notifications') return reply();
  const timer = setTimeout(reply, 20000);
  res.on('close', () => clearTimeout(timer));
}).listen(process.env.PORT);
