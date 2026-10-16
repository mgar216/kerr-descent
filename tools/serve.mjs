// Zero-dependency static dev server for ORPHEUS.
// ES modules and Web Audio decoding need http:// (file:// blocks both), so always run the game through this.
//   node tools/serve.mjs [port]        → http://localhost:5173/
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(ROOT, rel));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  let st;
  try { st = statSync(file); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 ' + rel); return; }
  if (st.isDirectory()) { res.writeHead(302, { Location: rel + '/' }).end(); return; }
  const audio = /\.(mp3|ogg|wav)$/i.test(file);
  res.writeHead(200, {
    'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': audio ? 'public, max-age=3600' : 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`ORPHEUS dev server → http://localhost:${PORT}/  (root ${ROOT})`));
