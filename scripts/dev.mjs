import { context } from 'esbuild';
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const useDist = process.argv.includes('--dist');
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.map': 'application/json' };
if (!useDist) {
  const ctx = await context({ entryPoints: { main: 'src/main.ts' }, bundle: true, sourcemap: true, outdir: '.dev', format: 'esm', target: 'es2022' });
  const css = await context({ entryPoints: { main: 'src/styles/main.css' }, bundle: true, outdir: '.dev' });
  await ctx.watch(); await css.watch();
}
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p === '/') p = '/index.html';
  const roots = useDist ? ['dist'] : ['.dev', 'public', '.'];
  for (const r of roots) {
    const f = join(r, p);
    if (!f.includes('..') && existsSync(f) && statSync(f).isFile() && (r !== '.' || p === '/index.html')) {
      res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream' });
      return res.end(readFileSync(f));
    }
  }
  res.writeHead(404); res.end('not found');
}).listen(port, () => console.log(`http://localhost:${port}`));
