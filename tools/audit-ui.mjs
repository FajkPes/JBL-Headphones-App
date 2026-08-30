import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const edge = process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(join(tmpdir(), 'jbl-ui-audit-'));
const browser = spawn(edge, [
  '--headless', '--disable-gpu', '--no-first-run',
  '--disable-features=msEdgeFirstRunExperience',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let target;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    target = pages.find(page => page.type === 'page');
    if (target) break;
  } catch {}
  await sleep(100);
}
if (!target) throw new Error('Could not connect to headless Edge.');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  message.error ? reject(new Error(message.error.message)) : resolve(message.result);
});
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  const reply = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  const timeout = new Promise((_, reject) => setTimeout(() => {
    pending.delete(id);
    reject(new Error(`${method} timed out`));
  }, 5000));
  return Promise.race([reply, timeout]);
}

const suspicious = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]|\b(?:není|nebo|jen|zatím|načíst|číslo|úroveň|pásm|profil|hodnot|nastaven|sluchát|zařízení|odpově|zápis|výběr|připoj|vypnut|zapnut|přehr|zvuk|tlačít|příkaz|ruční|bajty|rizikov|nevrat|přednastavení|levé|pravé|výchozí|neznám)\b/i;
const findings = [];

for (const model of ['tune720bt', 'tune780nc']) {
  for (const tab of ['devices', 'sound', 'controls', 'connection', 'system']) {
    console.log(`Auditing ${model} / ${tab}...`);
    const url = `http://127.0.0.1:8777/index.html?dev=${model}&tab=${tab}`;
    await send('Page.navigate', { url });
    await sleep(750);
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        const values = [document.body.innerText];
        for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]')) {
          values.push(el.title || '', el.placeholder || '', el.getAttribute('aria-label') || '');
        }
        return values.join('\\n');
      })()`,
      returnByValue: true,
    });
    const lines = String(result.result.value || '').split(/\r?\n/)
      .map(line => line.trim()).filter(Boolean).filter(line => suspicious.test(line));
    if (lines.length) findings.push({ model, tab, lines: [...new Set(lines)] });
  }
}

ws.close();
browser.kill();

if (findings.length) {
  for (const finding of findings) {
    console.error(`\n${finding.model} / ${finding.tab}`);
    for (const line of finding.lines) console.error(`  ${line}`);
  }
  console.error(`\nEnglish UI audit failed in ${findings.length} view(s).`);
  process.exit(1);
}
console.log('English UI audit passed for both models and every tab.');
