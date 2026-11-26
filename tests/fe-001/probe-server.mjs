import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';

const port = Number(process.env.PROBE_PORT ?? 8791);

const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  console.log(`${new Date().toISOString()} ${req.method} ${path}`);
  if (path === '/ok') {
    res.writeHead(200, { 'content-type': 'application/json', 'x-probe': 'ok' });
    res.end(JSON.stringify({ probe: true }));
    return;
  }
  if (path === '/unauthorized') {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ code: 'UNAUTHENTICATED', message: 'probe unauthorized' }));
    return;
  }
  if (path === '/slow') {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ probe: 'slow' }));
    }, 5000);
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 'NOT_FOUND' }));
});

server.listen(port, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces()).flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}`);
  console.log(`probe server listening on ${port}`);
  for (const address of addresses) console.log(address);
});
