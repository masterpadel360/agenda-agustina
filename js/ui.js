// Ayudas de pantalla compartidas (página de reservas y panel).
import { SPRITE } from './sprite.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ico = (n, cls = '', st = '') => `<svg class="i ${cls}"${st ? ` style="${st}"` : ''} aria-hidden="true"><use href="#i-${n}"/></svg>`;
export const emo = (n, size = 110, st = '', cls = '') => `<svg class="${cls}" viewBox="0 0 120 120" width="${size}" height="${size}"${st ? ` style="${st}"` : ''} aria-hidden="true"><use href="#emo-${n}"/></svg>`;
export const ola = () => '<svg class="wave" viewBox="0 0 360 40" preserveAspectRatio="none" aria-hidden="true"><use href="#wave"/></svg>';
export const EMOS = ['alegria', 'tristeza', 'enojo', 'miedo', 'desagrado', 'ansiedad'];

export function ponerSprite() {
  if (!document.getElementById('sprite')) {
    const d = document.createElement('div');
    d.id = 'sprite';
    d.innerHTML = SPRITE;
    document.body.prepend(d);
  }
}

// Las seis emociones juntas (inicio de la página de pacientes).
export function grupo6() {
  const p = [
    ['miedo', 26, 2, 98, 1], ['enojo', 104, 0, 90, 1], ['desagrado', 176, 14, 88, 1],
    ['tristeza', 2, 76, 92, 2], ['alegria', 88, 74, 112, 3], ['ansiedad', 190, 82, 92, 2],
  ];
  return `<div class="group6" aria-label="Las seis emociones juntas">${p.map(([n, x, y, s, z]) => emo(n, s, `left:${x}px;top:${y}px;z-index:${z}`)).join('')}</div>`;
}

export function hero({ clase = 'lav', arriba = '', titulo = '', sub = '', personaje = '', tam = 118, extra = '', ancho = false, estilo = '' }) {
  return `<header class="hero ${clase} grainy${ancho ? ' ancho' : ''}"${estilo ? ` style="${estilo}"` : ''}>
    <div>${arriba}${titulo ? `<h1>${titulo}</h1>` : ''}${sub ? `<p class="sub">${sub}</p>` : ''}${extra}</div>
    ${personaje ? emo(personaje, tam, `width:${tam}px;height:${tam}px`, 'chr') : ''}
    ${ola()}
  </header>`;
}

let tt;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(tt);
  tt = setTimeout(() => { el.hidden = true; }, ms);
}

export async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Achica fotos antes de subirlas (más rápido con datos móviles). PDFs quedan igual.
export async function achicarImagen(file, max = 1600, calidad = 0.82) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 900000) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', calidad));
    return blob ? new File([blob], 'comprobante.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
export const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Lee los valores de un formulario simple: data-k="campo"
export function leerForm(raiz) {
  const o = {};
  raiz.querySelectorAll('[data-k]').forEach((el) => {
    const k = el.dataset.k;
    if (el.type === 'checkbox') o[k] = el.checked;
    else if (el.type === 'number') o[k] = el.value === '' ? null : Number(el.value);
    else o[k] = el.value.trim();
  });
  return o;
}
