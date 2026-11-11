// Copia los personajes y los íconos de la maqueta aprobada (maqueta-C1.html) a js/sprite.js.
// Uso: node herramientas/armar-sprite.mjs [ruta a maqueta-C1.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const maqueta = process.argv[2] || path.resolve(raiz, '../../prompts/app-agustina/maquetas/maqueta-C1.html');
const html = fs.readFileSync(maqueta, 'utf8');
const a = html.indexOf('<defs>'), b = html.indexOf('</defs>');
let defs = html.slice(a + 6, b);
// Íconos extra que la app necesita (mismo trazo que los de la maqueta).
const extra = {
  'i-trash': '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h5a1.5 1.5 0 0 0 1.5-1.5L17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  'i-share': '<path d="M12 15V4M8 7.5 12 3.5l4 4M6 11H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 11h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  'i-download': '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 17v1A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  'i-image': '<rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17.5l5-4.5 3.5 3 3-2.5 4.5 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  'i-logout': '<path d="M14 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h7M10 12h10M16.5 8.5 20 12l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  'i-x': '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  'i-list': '<path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="5" cy="7" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="17" r="1.2" fill="currentColor"/>',
};
for (const [id, cuerpo] of Object.entries(extra)) if (!defs.includes(`id="${id}"`)) defs += `\n    <symbol id="${id}" viewBox="0 0 24 24">${cuerpo}</symbol>`;
defs = defs.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n');
const out = `// Generado por herramientas/armar-sprite.mjs desde la maqueta aprobada (C1). No editar a mano.
// 6 personajes propios (alegría, tristeza, enojo, miedo, desagrado, ansiedad) + íconos de línea.
export const SPRITE = \`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defs.replace(/`/g, '\\`')}</defs></svg>\`;
`;
fs.writeFileSync(path.join(raiz, 'js/sprite.js'), out);
console.log('js/sprite.js', out.length, 'bytes');
