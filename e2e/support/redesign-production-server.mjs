/** Local production SPA server for isolated redesign verification. No API proxy. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };

export async function startProductionServer(port = 4500) {
  const directory = path.join(repository, 'frontend/dist/frontend/browser');
  const index = path.join(directory, 'index.html');
  if (!fs.existsSync(index)) throw new Error('Production build missing; run npm run build in frontend first.');
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'NO_BACKEND', message: 'Isolated production server has no backend.' } }));
      return;
    }
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); }
    catch { response.writeHead(400).end(); return; }
    const requested = path.resolve(directory, '.' + decoded);
    if (!requested.startsWith(directory + path.sep) && requested !== directory) {
      response.writeHead(403).end(); return;
    }
    let filename = requested;
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      if (request.headers.accept?.includes('text/html')) filename = index;
      else { response.writeHead(404).end(); return; }
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(filename).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, origin: `http://127.0.0.1:${port}`, directory,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

if (process.argv.includes('--serve')) {
  const running = await startProductionServer(Number(process.env.REDESIGN_PORT ?? 4500));
  console.log(`Production SPA only: ${running.origin}; root=${running.directory}; API proxy disabled.`);
}
