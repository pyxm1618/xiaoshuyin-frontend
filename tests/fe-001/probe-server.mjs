import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';

const port = Number(process.env.PROBE_PORT ?? 8791);
const observed = [];
const chunksSent = new Map();

function record(entry) {
  observed.unshift(entry);
  if (observed.length > 32) observed.pop();
  console.log(`${new Date().toISOString()} ${entry.method} ${entry.path}${entry.note ? ` ${entry.note}` : ''}`);
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());
  const entry = {
    method: req.method ?? 'UNKNOWN',
    path,
    query,
    at: new Date().toISOString(),
    probeHeader: req.headers['x-probe-header'] ?? null,
  };
  record(entry);

  if (path === '/ok' && req.method === 'GET') {
    json(res, 200, { probe: true, path, query }, { 'x-probe': 'ok', 'cache-control': 'no-store' });
    return;
  }

  if (path === '/echo') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      json(res, 200, {
        method: req.method,
        path,
        query,
        probeHeader: entry.probeHeader,
        contentType: req.headers['content-type'] ?? null,
        body: Buffer.concat(chunks).toString('utf8'),
      });
    });
    return;
  }

  if (path === '/unauthorized') {
    json(res, 401, { code: 'UNAUTHENTICATED', message: 'probe unauthorized' });
    return;
  }

  if (path === '/slow') {
    const delay = Math.min(Number(query.ms ?? 5000), 30000);
    const timer = setTimeout(() => {
      if (!res.writableEnded) json(res, 200, { probe: 'slow', delayedMs: delay });
    }, delay);
    req.on('close', () => {
      clearTimeout(timer);
      entry.note = `client-closed-after-${Date.now() - Date.parse(entry.at)}ms`;
    });
    return;
  }

  if (path === '/method') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      record({ ...entry, method: `SERVER-OBSERVED ${req.method}`, note: body.slice(0, 200) });
      json(res, 200, { observedMethod: req.method, body });
    });
    return;
  }

  if (path === '/observed') {
    json(res, 200, { observed: observed.slice(0, 12) });
    return;
  }

  if (path === '/chunks') {
    const count = Math.min(Number(query.count ?? 6), 50);
    const interval = Math.min(Number(query.interval ?? 400), 5000);
    const id = `${Date.now()}`;
    chunksSent.set(id, 0);
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
      'transfer-encoding': 'chunked',
    });
    res.flushHeaders();
    let index = 0;
    const timer = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(timer);
        return;
      }
      index += 1;
      chunksSent.set(id, index);
      res.write(`chunk-${index}@${Date.now()}\n`);
      if (index >= count) {
        clearInterval(timer);
        res.end('done\n');
        record({ ...entry, note: `chunked count=${count} interval=${interval}` });
      }
    }, interval);
    req.on('close', () => {
      clearInterval(timer);
      record({ ...entry, note: `chunked closed at ${chunksSent.get(id)}/${count}` });
    });
    return;
  }

  if (path === '/buffered') {
    const count = Math.min(Number(query.count ?? 6), 50);
    const interval = Math.min(Number(query.interval ?? 400), 5000);
    const timer = setTimeout(() => {
      const body = Array.from({ length: count }, (_, i) => `chunk-${i + 1}@${Date.now()}\n`).join('') + 'done\n';
      if (!res.writableEnded) {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(body) });
        res.end(body);
      }
    }, interval * count);
    req.on('close', () => clearTimeout(timer));
    return;
  }

  if (path === '/results' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      console.log(`PROBE-RESULTS ${body}`);
      json(res, 200, { stored: true });
    });
    return;
  }

  json(res, 404, { code: 'NOT_FOUND', method: req.method, path });
});

server.listen(port, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces()).flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}`);
  console.log(`probe server listening on ${port}`);
  for (const address of addresses) console.log(address);
});