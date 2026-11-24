// Post-build: prerender every route to static HTML, then write the sitemap, OG image,
// apple-touch-icon, _headers and _redirects. Run after `vite build` and the SSR build.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const out = join(dist, 'cmb');
const SITE = 'https://jackstanton.dev/cmb';

const template = readFileSync(join(out, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(out, '.vite', 'manifest.json'), 'utf8'));
const server = await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href);

/** CSS files and JS chunks needed by a module, following static imports. */
function assetsFor(key, seen = new Set(), acc = { css: new Set(), js: new Set() }) {
  if (!key || seen.has(key) || !manifest[key]) return acc;
  seen.add(key);
  const chunk = manifest[key];
  acc.js.add(chunk.file);
  for (const c of chunk.css ?? []) acc.css.add(c);
  for (const imp of chunk.imports ?? []) assetsFor(imp, seen, acc);
  return acc;
}

const entry = assetsFor('index.html');

function write(path, html) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
}

async function page(path) {
  const { html, head, routeIds } = await server.render(path);
  const acc = { css: new Set(), js: new Set() };
  for (const id of routeIds) {
    const file = server.routeFiles[id];
    if (file) assetsFor(file, new Set(), acc);
  }
  const extra = [
    ...[...acc.css].filter((c) => !entry.css.has(c)).map((c) => `<link rel="stylesheet" href="/cmb/${c}" />`),
    ...[...acc.js].filter((j) => !entry.js.has(j)).map((j) => `<link rel="modulepreload" href="/cmb/${j}" />`),
  ];
  const doc = template
    .replace('<!--head-->', [server.headToHtml(head), ...extra].join('\n    '))
    .replace('<!--app-->', html);
  return { doc, head };
}

const paths = server.prerenderPaths();
const today = new Date().toISOString().slice(0, 10);
for (const p of paths) {
  const { doc } = await page(p);
  write(join(out, p, 'index.html'), doc);
}
const notFound = await page('/__not-found__/');
write(join(out, '404.html'), notFound.doc);
console.log(`Prerendered ${paths.length} routes + 404.html`);

// Sitemap
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(out, 'sitemap.xml'), sitemap);

// CSP hash for the inline theme script (applied before first paint).
const inline = /<script>([\s\S]*?)<\/script>/.exec(template)[1];
const hash = createHash('sha256').update(inline).digest('base64');
const csp = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${hash}'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

writeFileSync(join(dist, '_headers'), `/cmb/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: ${csp}
  Cache-Control: no-cache

/cmb/assets/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
`);
writeFileSync(join(dist, '_redirects'), '/cmb /cmb/ 301\n');

// OG image and apple-touch-icon, rendered from SVG with KaTeX's bundled fonts (deterministic).
const fontDir = join(root, 'node_modules', 'katex', 'dist', 'fonts');
const fontFiles = ['KaTeX_SansSerif-Regular.ttf', 'KaTeX_SansSerif-Bold.ttf', 'KaTeX_Math-Italic.ttf', 'KaTeX_Main-Regular.ttf']
  .map((f) => join(fontDir, f)).filter(existsSync);
const renderPng = (svg, width) => new Resvg(svg, {
  fitTo: { mode: 'width', value: width },
  font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'KaTeX_SansSerif' },
}).render().asPng();

const ogSvg = readFileSync(join(root, 'scripts', 'og-template.svg'), 'utf8');
writeFileSync(join(out, 'og.png'), renderPng(ogSvg, 1200));
const icon = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8')
  .replace('<svg ', '<svg style="background:#FAF9F6" ')
  .replace(/<\/svg>\s*$/, '</svg>');
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="#FAF9F6"/><g transform="translate(26 26) scale(4)">${icon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g></svg>`;
writeFileSync(join(out, 'apple-touch-icon.png'), renderPng(iconSvg, 180));

rmSync(join(out, '.vite'), { recursive: true, force: true });
console.log('Wrote sitemap.xml, og.png, apple-touch-icon.png, _headers, _redirects');
