// Tiny static server for e2e tests: mimics the Worker's asset handling for dist/.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '..', 'dist');
const port = Number(process.argv[2] ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json' };

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/cmb') return res.writeHead(301, { Location: '/cmb/' }).end();
  let file = normalize(join(dist, p));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!p.endsWith('/')) return res.writeHead(307, { Location: p + '/' }).end();
    file = join(file, 'index.html');
  } else if (!existsSync(file) && existsSync(join(file, 'index.html'))) {
    return res.writeHead(307, { Location: p + '/' }).end();
  }
  if (!existsSync(file)) {
    res.writeHead(404, { 'Content-Type': types['.html'] });
    return res.end(readFileSync(join(dist, 'cmb', '404.html')));
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`Serving dist/ on http://localhost:${port}/cmb/`));
