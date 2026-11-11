// Genera iconos/icono-180.png, -192.png y -512.png a partir de logo/icono.svg con Chrome sin ventana.
// Uso: node herramientas/generar-iconos.mjs   (si cambiás el logo, cambiá logo/icono.svg y volvé a correrlo)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const svg = fs.readFileSync(path.join(raiz, 'logo/icono.svg'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iconos-'));
for (const n of [180, 192, 512]) {
  const html = path.join(tmp, `i${n}.html`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;overflow:hidden">${svg.replace('<svg ', `<svg width="${n}" height="${n}" style="display:block" `)}</body></html>`);
  const out = path.join(raiz, `iconos/icono-${n}.png`);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${path.join(tmp, 'perfil')}`, `--window-size=${n},${n}`, `--screenshot=${out}`, pathToFileURL(html).href], { stdio: 'ignore' });
  console.log('ok', out, fs.statSync(out).size, 'bytes');
}
fs.rmSync(tmp, { recursive: true, force: true });
