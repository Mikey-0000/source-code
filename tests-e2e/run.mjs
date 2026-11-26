// Browser end-to-end test. Needs a built `dist/` and Chrome (set CHROME_PATH, default /usr/bin/google-chrome).
// Usage: npm run build && node tests-e2e/run.mjs   (writes screenshots to docs/screenshots, report to docs/E2E_RESULTS.json)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const dist = path.join(root, 'dist'); const shots = path.join(root, 'docs', 'screenshots'); fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.map': 'application/json' };
const server = http.createServer((req, res) => { let p = path.join(dist, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith(path.sep)) p += 'index.html'; if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('nf'); } res.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream'); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, r)); const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('requestfailed', r => errors.push('requestfailed ' + r.url()));
const results = []; const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '')); };
const shot = n => page.screenshot({ path: path.join(shots, n + '.jpg'), type: 'jpeg', quality: 82 }); const eden = fn => page.evaluate(fn);
const nonBlack = () => page.evaluate(() => { const c = document.querySelector('canvas.out'); const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const x = t.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) n++; return n; });
const dismissDialogue = async () => { for (let i = 0; i < 12; i++) { const open = await eden(() => window.__eden.game.dialogue.open); if (!open) break; await page.keyboard.press('KeyE'); await page.waitForTimeout(350); } };

// 1 boot
await page.goto(base); await page.waitForTimeout(600); await shot('01_boot_gate'); check('boot gate shown', await page.locator('.boot').count() > 0);
await page.keyboard.press('Enter'); await page.waitForTimeout(3000); await shot('02_boot_sequence');
await page.goto(base + '?skipboot=1'); await page.waitForSelector('.title'); await page.waitForTimeout(1200); await shot('03_title'); check('title menu has NEW GAME', await page.locator('text=NEW GAME').count() > 0);
// 2 start
await page.click('text=NEW GAME'); await page.waitForTimeout(1900); await shot('04_chapter_card'); await page.waitForTimeout(2200); await dismissDialogue();
check('canvas renders pixels', (await nonBlack()) > 20000, String(await nonBlack())); await shot('05_boot_01');
// 2b how-to-play guide
await eden(() => window.__eden.game.openPause()); await page.waitForTimeout(300); await page.click('.pause >> text=HOW TO PLAY'); await page.waitForTimeout(300); check('in-game HOW TO PLAY guide opens', await page.locator('.guide').count() > 0); await shot('05b_guide'); await page.click('.guide .btn'); await page.click('.pause >> text=RESUME'); await page.waitForTimeout(200);
// 3 movement
const x0 = await eden(() => window.__eden.game.world.x); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight'); const x1 = await eden(() => window.__eden.game.world.x); check('player moves right', x1 > x0 + 40, `${x0.toFixed(0)}→${x1.toFixed(0)}`);
await page.keyboard.down('Space'); await page.waitForTimeout(120); const vy = await eden(() => window.__eden.game.world.vy); check('jump gives upward velocity', vy < 0, String(vy)); await page.keyboard.up('Space'); await page.waitForTimeout(900);
// 3b infinite jump assist (J toggles)
await page.keyboard.press('KeyJ'); await page.waitForTimeout(200); check('J enables infinite jump', await eden(() => window.__eden.settings.infiniteJump) === true);
const yGround = await eden(() => window.__eden.game.world.y); let yMin = yGround; for (let i = 0; i < 8; i++) { await page.keyboard.down('Space'); await page.waitForTimeout(90); await page.keyboard.up('Space'); await page.waitForTimeout(110); yMin = Math.min(yMin, await eden(() => window.__eden.game.world.y)); }
check('mid-air re-jumps climb far above a single jump (45 px)', yGround - yMin > 100, `climbed ${(yGround - yMin).toFixed(0)} px`);
await page.keyboard.press('KeyJ'); await page.waitForTimeout(1500);
// 4 editor flow (walk to terminal via teleport, as the terminal unlock is covered by unit tests)
await eden(() => { const g = window.__eden.game; window.__eden.story.data.editorRevealed = true; g.openPanel(true); }); await page.waitForTimeout(700);
const ta = page.locator('.ce-ta'); await ta.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('player.speed = 3.5;\nplayer.jumpHeight = 120;\n'); await page.waitForTimeout(400);
const prev = await page.locator('.ep-preview').innerText(); check('live preview updates while typing', /apex\s*120/.test(prev), prev.slice(0, 60)); await shot('06_editor_typing');
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(700); const jh = await eden(() => window.__eden.game.world.rule.player.jumpHeight); check('compile applies rules to the live world', jh === 120, 'jumpHeight=' + jh); await shot('07_editor_applied');
await ta.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('player.jumpHeight = ;'); await page.waitForTimeout(400); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(500);
check('syntax error is reported, rules unchanged', (await eden(() => window.__eden.game.world.rule.player.jumpHeight)) === 120 && /ERROR/i.test(await page.locator('.ep-status').innerText())); await shot('08_syntax_error');
await ta.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('player.jumpHeight = 9999;\n'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(500);
check('out-of-range values are clamped/rejected by the sandbox', (await eden(() => window.__eden.game.world.rule.player.jumpHeight)) <= 130);
// 5 corruption + sandbox
const cor = await eden(() => window.__eden.game.world.corruption); check('corruption reflects changed rules', cor > 0, 'corruption=' + cor);
// 6 level completion
await eden(() => { const g = window.__eden.game; g.closePanel(); const w = g.world; w.exitOpen = true; w.x = w.level.exit[0] * 32 + 9; w.y = w.level.exit[1] * 32 + 4; }); await page.waitForSelector('.card.complete', { timeout: 6000 }); await shot('09_level_complete'); check('exit shows SECTOR COMPLETE card', true);
await page.click('.card.complete .btn.primary'); await page.waitForTimeout(1800); check('CONTINUE loads next level', (await eden(() => window.__eden.game.levelIndex)) === 1, 'levelIndex=' + await eden(() => window.__eden.game.levelIndex));
// 7 per-level screenshots
const names = ['boot_01', 'boot_02', 'exc_01', 'exc_02', 'exc_03', 'boss_watcher'];
for (let i = 0; i < names.length; i++) { await eden(`(async()=>{const g=window.__eden.game; g.overlay.hidden=true; g.paused=false; window.__eden.story.data.editorRevealed=true; await g.loadLevel(${i}, false); g.dialogue.open=false; g.dialogue.root.hidden=true;})()`); await page.waitForTimeout(1300); await shot('10_' + names[i]); const px = await nonBlack(); check(`level ${names[i]} renders`, px > 15000, 'px=' + px);
  await eden(() => window.__eden.game.openPanel(false)); await page.waitForTimeout(700); await shot('11_' + names[i] + '_editor'); await eden(() => window.__eden.game.closePanel()); await page.waitForTimeout(200); }
// 8 settings & OS
await eden(() => window.__eden.game.hide()); await eden(() => window.__eden.enterRoot()); await page.waitForTimeout(1500); await shot('12_eden_os'); check('EDEN OS desktop opens', await page.locator('.os').count() > 0);
check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
fs.writeFileSync(path.join(root, 'docs', 'E2E_RESULTS.json'), JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
await browser.close(); server.close(); process.exit(results.every(r => r.ok) ? 0 : 1);
