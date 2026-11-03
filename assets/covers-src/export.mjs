// Exporta capas e lombadas de covers.html para assets/covers/*.jpg via Chromium (CDP).
// Uso: com o servidor local rodando na porta 5180, `node assets/covers-src/export.mjs`
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('../covers/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const chrome = spawn('chromium', ['--headless=new', '--remote-debugging-port=9335', '--hide-scrollbars', '--user-data-dir=' + tmpdir() + '/entropy-covers', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:9335/json')).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5180/assets/covers-src/covers.html' });
await sleep(2500);
await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
await sleep(800);
const rects = JSON.parse((await send('Runtime.evaluate', { expression: `JSON.stringify([...document.querySelectorAll('.row')].map(r => { const c = r.querySelector('.cv').getBoundingClientRect(), s = r.querySelector('.sp').getBoundingClientRect(); return { k: r.dataset.k, c: [c.x, c.y + scrollY], s: [s.x, s.y + scrollY] }; }))`, returnByValue: true })).result.result.value);
for (const r of rects) {
  for (const [part, [x, y], w] of [['cover', r.c, 660], ['spine', r.s, 168]]) {
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: true, clip: { x, y, width: w, height: 1000, scale: 1 } });
    writeFileSync(`${OUT}${r.k}-${part}.jpg`, Buffer.from(shot.result.data, 'base64'));
  }
  console.log('ok', r.k);
}
ws.close(); chrome.kill();
