// Imagen del recordatorio: toma la plantilla ("Recordatorio de tu sesión", con DÍA y HORA en blanco)
// y escribe el día y la hora de la sesión sobre las líneas. Devuelve un PNG para compartir por WhatsApp.
// pos: { dia_y, hora_y, x1, x2, tam, color } en fracciones de la imagen (ver IMG_RECORDATORIO en logica.js).
import { IMG_RECORDATORIO } from './logica.js';

export const PLANTILLA_APP = 'recordatorio/plantilla-recordatorio.jpeg';
export const FUENTE = '"Nunito", "Helvetica Neue", Arial, sans-serif';

async function cargarImagen(src) {
  const img = new Image();
  img.decoding = 'async';
  if (/^https?:/.test(src) && !src.startsWith(location.origin)) img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  return img;
}

export async function dibujarRecordatorio({ plantilla = PLANTILLA_APP, dia, hora, pos = {} }, canvas = document.createElement('canvas')) {
  const p = { ...IMG_RECORDATORIO, ...(pos || {}) };
  const img = await cargarImagen(plantilla);
  const W = img.naturalWidth, H = img.naturalHeight;
  canvas.width = W; canvas.height = H;
  const cx = canvas.getContext('2d');
  cx.drawImage(img, 0, 0, W, H);
  const tam = Math.round(W * p.tam);
  try { await document.fonts.load(`600 ${tam}px "Nunito"`); } catch { /* usa Georgia */ }
  const x1 = W * p.x1, x2 = W * p.x2, ancho = x2 - x1;
  cx.fillStyle = p.color || '#3E463B';
  cx.textAlign = 'center';
  cx.textBaseline = 'alphabetic';
  for (const [texto, fy] of [[dia, p.dia_y], [hora, p.hora_y]]) {
    if (!texto) continue;
    let t = tam;
    cx.font = `600 ${t}px ${FUENTE}`;
    while (cx.measureText(texto).width > ancho * 0.96 && t > 10) { t -= 2; cx.font = `600 ${t}px ${FUENTE}`; }
    cx.fillText(texto, x1 + ancho / 2, H * fy - Math.round(t * 0.28)); // apoyado sobre la línea
  }
  return canvas;
}

export async function imagenRecordatorio(opts) {
  const c = await dibujarRecordatorio(opts);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new File([blob], 'recordatorio-sesion.png', { type: 'image/png' });
}
