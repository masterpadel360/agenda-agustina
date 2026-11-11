// =====================================================================
// Lógica pura de la app (sin pantalla ni base). La usan la página de
// reservas, el panel, el modo demo y las pruebas.
// La base real repite estas mismas reglas en supabase/schema.sql y la
// función de avisos tiene una copia de planAvisos(): mantenerlas iguales.
//
// Horas: todo se guarda como milisegundos UTC. Córdoba es UTC-3 todo el año.
// "dia" = 'AAAA-MM-DD' en hora de Córdoba. "hora" = 'HH:MM'.
// =====================================================================
export const OFFSET_MS = -3 * 3600e3;
export const HORA = 3600e3;
export const DIA = 24 * HORA;
export const EDAD_MINIMA = 15;
export const EDAD_ADULTO = 18;

const pad = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- fechas
export const diaDe = (ms) => new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
export const horaDe = (ms) => new Date(ms + OFFSET_MS).toISOString().slice(11, 16);
export function minutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export function msDe(dia, hora = '00:00') {
  const [y, mo, d] = dia.split('-').map(Number);
  return Date.UTC(y, mo - 1, d) + minutos(hora) * 60000 - OFFSET_MS;
}
export function sumarDias(dia, n) {
  const [y, mo, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}
// 1 = lunes … 7 = domingo
export function diaSemana(dia) {
  const [y, mo, d] = dia.split('-').map(Number);
  return ((new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7) + 1;
}
export function lunesDe(dia) { return sumarDias(dia, 1 - diaSemana(dia)); }

export const DIAS_CORTOS = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
export const DIAS_LARGOS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "miércoles 18 nov"
export function fechaLarga(dia, mayus = false) {
  const s = `${DIAS_LARGOS[diaSemana(dia)]} ${Number(dia.slice(8))} ${MESES[Number(dia.slice(5, 7)) - 1]}`;
  return mayus ? cap(s) : s;
}
// "mié 18"
export function fechaCorta(dia, mayus = false) {
  const s = `${DIAS_CORTOS[diaSemana(dia)]} ${Number(dia.slice(8))}`;
  return mayus ? cap(s) : s;
}
// "hoy", "mañana", "el jueves 19"
export function cuando(ms, ahora) {
  const d = diaDe(ms), h = diaDe(ahora);
  if (d === h) return 'hoy';
  if (d === sumarDias(h, 1)) return 'mañana';
  return `el ${DIAS_LARGOS[diaSemana(d)]} ${Number(d.slice(8))}`;
}
export function precio(n) { return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }

// ---------------------------------------------------------------- edad
export function edad(nacimiento, hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nacimiento || ''))) return null;
  const [y, m, d] = nacimiento.split('-').map(Number);
  const [Y, M, D] = hoy.split('-').map(Number);
  let e = Y - y;
  if (M < m || (M === m && D < d)) e--;
  return e;
}
// 'invalida' | 'menor' (no puede reservar) | 'responsable' (15–17: pide adulto) | 'ok'
export function reglaEdad(nacimiento, hoy) {
  const e = edad(nacimiento, hoy);
  if (e == null || e < 0 || e > 110) return 'invalida';
  if (e < EDAD_MINIMA) return 'menor';
  if (e < EDAD_ADULTO) return 'responsable';
  return 'ok';
}
export const soloDigitos = (s) => String(s || '').replace(/\D/g, '');

// Valida el formulario del paciente. Devuelve el texto del error o null.
export function validarDatos(d, hoy) {
  if (!d || String(d.nombre || '').trim().length < 3) return 'Escribí tu nombre y apellido.';
  if (soloDigitos(d.telefono).length < 8) return 'Revisá tu WhatsApp: tiene que tener código de área.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email).trim())) return 'Revisá tu mail (o dejalo vacío).';
  const r = reglaEdad(d.nacimiento, hoy);
  if (r === 'invalida') return 'Revisá tu fecha de nacimiento.';
  if (r === 'menor') return `La atención es desde los ${EDAD_MINIMA} años.`;
  if (r === 'responsable') {
    if (String(d.responsable_nombre || '').trim().length < 3) return 'Sumá el nombre del adulto responsable.';
    if (soloDigitos(d.responsable_telefono).length < 8) return 'Sumá el teléfono del adulto responsable.';
  }
  if (typeof d.primera_vez !== 'boolean') return 'Contanos si es tu primera vez.';
  if (String(d.motivo || '').length > 600) return 'El motivo es muy largo (hasta 600 letras).';
  return null;
}

// ---------------------------------------------------------------- cambio de turno
export const limiteCambio = (inicio, horas = 24) => inicio - horas * HORA;
export const puedeCambiar = (inicio, ahora, horas = 24) => ahora < limiteCambio(inicio, horas);

// ---------------------------------------------------------------- Mi vida
// Ocurrencias de eventos (y tareas con día) entre dos días, inclusive.
// evento: { id, tipo:'evento'|'tarea', titulo, fecha, hora_inicio?, hora_fin?, repetir:'no'|'semanal', aviso_min?, bloquea, hecho, color }
export function ocurrencias(eventos, desdeDia, hastaDia) {
  const out = [];
  for (const ev of eventos || []) {
    if (!ev.fecha) continue;
    if (ev.repetir === 'semanal') {
      let d = ev.fecha;
      const dow = diaSemana(ev.fecha);
      if (d < desdeDia) d = sumarDias(desdeDia, (dow - diaSemana(desdeDia) + 7) % 7);
      for (; d <= hastaDia; d = sumarDias(d, 7)) out.push(ocurrencia(ev, d));
    } else if (ev.fecha >= desdeDia && ev.fecha <= hastaDia) out.push(ocurrencia(ev, ev.fecha));
  }
  return out.sort((a, b) => a.inicio - b.inicio);
}
function ocurrencia(ev, dia) {
  const conHora = minutos(ev.hora_inicio) != null;
  const inicio = conHora ? msDe(dia, ev.hora_inicio) : msDe(dia, '00:00');
  let fin = conHora && minutos(ev.hora_fin) != null ? msDe(dia, ev.hora_fin) : (conHora ? inicio + HORA : inicio + DIA);
  if (fin <= inicio) fin = inicio + HORA;
  return { evento: ev, dia, inicio, fin, todoElDia: !conHora };
}

// ---------------------------------------------------------------- horarios libres
const choca = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
export function enBloqueo(dia, bloqueos, modalidad) {
  return (bloqueos || []).some((b) => dia >= b.desde && dia <= (b.hasta || b.desde) && (!b.modalidad || b.modalidad === modalidad));
}

// Tramos ocupados (sin datos de nadie: solo inicio y fin).
// retenciones: { token, inicio, fin, expira }. Se ignora la propia (excluirRet) y la del turno que se cambia.
export function ocupados({ turnos = [], retenciones = [], eventos = [], excluirTurno = null, excluirRet = null, desdeDia, hastaDia, ahora }) {
  const out = [];
  for (const t of turnos) if (t.estado === 'reservado' && t.id !== excluirTurno) out.push({ inicio: t.inicio, fin: t.fin });
  for (const r of retenciones) if (r.expira > ahora && r.token !== excluirRet) out.push({ inicio: r.inicio, fin: r.fin });
  for (const o of ocurrencias((eventos || []).filter((e) => e.bloquea && e.tipo !== 'tarea'), desdeDia, hastaDia)) out.push({ inicio: o.inicio, fin: o.fin });
  return out;
}

// Turnos posibles de un día para una modalidad (antes de mirar ocupados).
export function grillaDelDia(mod, dia) {
  if (!mod || !mod.activa) return [];
  const paso = Number(mod.duracion) + Number(mod.descanso || 0);
  const dur = Number(mod.duracion);
  if (!(dur > 0) || !(paso > 0)) return [];
  const out = [];
  for (const [a, b] of (mod.horario || {})[String(diaSemana(dia))] || []) {
    const ma = minutos(a), mb = minutos(b === '24:00' ? '24:00' : b);
    if (ma == null || mb == null) continue;
    for (let m = ma; m + dur <= mb; m += paso) out.push(m);
  }
  return [...new Set(out)].sort((x, y) => x - y).map((m) => {
    const inicio = msDe(dia, hhmm(m));
    return { hora: hhmm(m), inicio, fin: inicio + dur * 60000 };
  });
}

// Horarios libres de un día. reglas: { anticipacionHoras, horizonteDias }
export function slotsLibres({ mod, dia, ahora, bloqueos, ocupados: occ = [], anticipacionHoras = 0, horizonteDias = 60 }) {
  if (enBloqueo(dia, bloqueos, mod && mod.id)) return [];
  const desde = ahora + anticipacionHoras * HORA;
  const hasta = msDe(sumarDias(diaDe(ahora), horizonteDias + 1));
  return grillaDelDia(mod, dia).filter((s) => s.inicio >= desde && s.inicio < hasta && !occ.some((o) => choca(s.inicio, s.fin, o.inicio, o.fin)));
}

// ¿Este inicio es un turno válido de la grilla? (la base hace la misma cuenta en slot_valido)
export function esSlotValido({ mod, inicio, ahora, bloqueos, anticipacionHoras = 0, horizonteDias = 60 }) {
  const dia = diaDe(inicio);
  return slotsLibres({ mod, dia, ahora, bloqueos, ocupados: [], anticipacionHoras, horizonteDias }).some((s) => s.inicio === inicio);
}

// Resumen de días hábiles de una modalidad: [{ dia, libres }]
export function diasDisponibles(args, desdeDia, cantidad) {
  const out = [];
  for (let i = 0; i < cantidad; i++) {
    const dia = sumarDias(desdeDia, i);
    out.push({ dia, atiende: grillaDelDia(args.mod, dia).length > 0 && !enBloqueo(dia, args.bloqueos, args.mod && args.mod.id), libres: slotsLibres({ ...args, dia }).length });
  }
  return out;
}

// Texto corto del horario semanal: "Lun, mié y vie · 9–13 y 15–19 h"
export function textoHorario(mod) {
  if (!mod || !mod.activa) return 'Sin horarios por ahora';
  const grupos = new Map();
  for (let d = 1; d <= 7; d++) {
    const t = ((mod.horario || {})[String(d)] || []).map(([a, b]) => `${corta(a)}–${corta(b)}`).join(' y ');
    if (!t) continue;
    if (!grupos.has(t)) grupos.set(t, []);
    grupos.get(t).push(d);
  }
  if (!grupos.size) return 'Sin horarios por ahora';
  return [...grupos].map(([t, ds]) => `${listaDias(ds)} ${t} h`).join(' · ');
}
const corta = (h) => (h.endsWith(':00') ? String(Number(h.slice(0, 2))) : h.replace(/^0/, ''));
function listaDias(ds) {
  const n = ds.map((d) => DIAS_CORTOS[d]);
  const s = n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
  return cap(s);
}

// ---------------------------------------------------------------- WhatsApp
// Número argentino a formato wa.me: 351 555-0100 → 5493515550100
export function numeroWa(tel) {
  let n = soloDigitos(tel);
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0')) n = n.slice(1);
  if (n.startsWith('54')) { if (!n.startsWith('549')) n = '549' + n.slice(2); return n; }
  if (n.length === 10) return '549' + n;
  if (n.length === 12) for (const k of [2, 3, 4]) if (n.slice(k, k + 2) === '15') return '549' + n.slice(0, k) + n.slice(k + 2); // 0351 15 ...
  return n;
}
export function linkWa(tel, texto = '') {
  const n = numeroWa(tel);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : '';
  return n ? `https://wa.me/${n}${q}` : `https://wa.me/${q}`;
}

// ---------------------------------------------------------------- plantillas
export const PLANTILLA_RECORDATORIO = 'Hola {nombre}! Te recuerdo tu sesión {dia} a las {hora} ({modalidad}). {link_videollamada}\nSi no podés asistir, avisame con al menos 24 horas de anticipación. De lo contrario, la sesión se abona igualmente.\nGracias por comprender y valorar este espacio.';

// Textos que se escriben sobre la imagen del recordatorio: "Martes 11 de noviembre" y "18:00 hs".
export function textoDiaImagen(ms) {
  const d = diaDe(ms);
  return `${cap(DIAS_LARGOS[diaSemana(d)])} ${Number(d.slice(8))} de ${MESES_LARGOS[Number(d.slice(5, 7)) - 1]}`;
}
export const textoHoraImagen = (ms) => `${horaDe(ms)} hs`;
// Dónde va el texto en la plantilla que viene con la app (fracciones del ancho/alto; medido sobre 1122×1402).
export const IMG_RECORDATORIO = { dia_y: 0.4565, hora_y: 0.5474, x1: 0.262, x2: 0.8957, tam: 0.042, color: '#3E463B' };

export function llenarPlantilla(tpl, vars) {
  return String(tpl || '')
    .replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
    .replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
export const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
export function varsTurno(turno, paciente, ajustes) {
  const dia = diaDe(turno.inicio);
  const virtual = turno.modalidad === 'virtual';
  return {
    nombre: primerNombre(paciente && paciente.nombre),
    dia: `el ${fechaLarga(dia)}`,
    hora: horaDe(turno.inicio),
    modalidad: virtual ? 'virtual' : 'presencial',
    link_videollamada: virtual && ajustes.link_videollamada ? `Link: ${ajustes.link_videollamada}` : '',
  };
}
export function textoRecordatorio(turno, paciente, ajustes) {
  return llenarPlantilla(ajustes.recordatorio_texto || PLANTILLA_RECORDATORIO, varsTurno(turno, paciente, ajustes));
}

// ---------------------------------------------------------------- avisos programados
// Qué avisos al celu de Agustina tocan en el tramo (desde, hasta].
// Cada aviso: { clave (única, para no repetir), at, tipo, titulo, cuerpo, url, turno_id?, horas? }
// tipos: 'recordatorio' (recordale al paciente), 'vida' (evento/tarea propia), 'resumen' (8:00), 'pendientes' (20:00)
// (copia en supabase/functions/avisos/index.ts: mantenerlas iguales; las pruebas lo verifican)
export function planAvisos({ ajustes, turnos = [], pacientes = [], eventos = [] }, desde, hasta) {
  const av = (ajustes && ajustes.avisos) || {};
  const out = [];
  const nombreDe = new Map(pacientes.map((p) => [p.id, p.nombre]));
  const en = (at) => at > desde && at <= hasta;

  // 1. Recordatorios a pacientes: X horas antes de cada sesión.
  if (av.recordatorios !== false) {
    for (const t of turnos) {
      if (t.estado !== 'reservado' || t.inicio <= desde) continue;
      for (const h of ajustes.recordatorio_horas || []) {
        const at = t.inicio - Number(h) * HORA;
        if (!en(at)) continue;
        if (at < (t.agendado_at || t.creado_at || 0)) continue; // se reservó después: no hace falta
        const nom = primerNombre(nombreDe.get(t.paciente_id)) || 'tu paciente';
        out.push({
          clave: `rec:${t.id}:${h}:${t.inicio}`, at, tipo: 'recordatorio', turno_id: t.id, horas: Number(h),
          titulo: `Recordale a ${nom}`, cuerpo: `${cuando(t.inicio, at)} ${horaDe(t.inicio)} · ${t.modalidad === 'virtual' ? 'virtual' : 'presencial'}. Tocá para mandarle el WhatsApp.`,
          url: `#recordar/${t.id}`,
        });
      }
    }
  }
  // Recorre los días del tramo (en hora de Córdoba).
  const dias = [];
  for (let d = diaDe(desde); d <= diaDe(hasta); d = sumarDias(d, 1)) dias.push(d);

  // 2. Mi vida: aviso X minutos antes.
  if (av.vida !== false) {
    for (const o of ocurrencias(eventos, sumarDias(dias[0], -1), sumarDias(dias[dias.length - 1], 2))) {
      const ev = o.evento;
      if (ev.aviso_min == null || ev.aviso_min === '' || o.todoElDia || (ev.tipo === 'tarea' && ev.hecho)) continue;
      const at = o.inicio - Number(ev.aviso_min) * 60000;
      if (!en(at)) continue;
      const falta = Number(ev.aviso_min);
      const txt = falta === 0 ? 'Ahora' : falta < 60 ? `En ${falta} min` : falta < 1440 ? `En ${falta / 60} h` : 'Mañana';
      out.push({ clave: `vida:${ev.id}:${o.dia}:${falta}`, at, tipo: 'vida', titulo: ev.titulo, cuerpo: `${txt} · ${horaDe(o.inicio)}${falta >= 1440 ? ' · ' + fechaLarga(o.dia) : ''}`, url: '#vida' });
    }
  }
  // 3. Resumen del día y 4. pendientes de la noche.
  for (const d of dias) {
    if (av.resumen !== false) {
      const at = msDe(d, ajustes.resumen_hora || '08:00');
      if (en(at)) {
        const hoy = turnos.filter((t) => t.estado === 'reservado' && diaDe(t.inicio) === d).sort((a, b) => a.inicio - b.inicio);
        const mias = ocurrencias(eventos.filter((e) => e.tipo !== 'tarea'), d, d);
        const ses = hoy.length === 0 ? 'Hoy no tenés sesiones' : hoy.length === 1 ? 'Hoy tenés 1 sesión' : `Hoy tenés ${hoy.length} sesiones`;
        const lista = hoy.slice(0, 4).map((t) => `${horaDe(t.inicio)} ${primerNombre(nombreDe.get(t.paciente_id))}`).join(' · ');
        const extra = mias.length ? ` · ${mias.length} ${mias.length === 1 ? 'cosa tuya' : 'cosas tuyas'}` : '';
        const senas = hoy.filter((t) => t.sena !== 'confirmada').length;
        out.push({ clave: `resumen:${d}`, at, tipo: 'resumen', titulo: `Buen día, Agustina`, cuerpo: `${ses}${lista ? ': ' + lista : ''}${hoy.length > 4 ? '…' : ''}${extra}${senas ? ` · ${senas} ${senas === 1 ? 'seña' : 'señas'} sin confirmar` : ''}.`, url: '#hoy' });
      }
    }
    if (av.pendientes !== false) {
      const at = msDe(d, ajustes.pendientes_hora || '20:00');
      const pend = eventos.filter((e) => e.tipo === 'tarea' && !e.hecho && (!e.fecha || e.fecha <= d));
      if (en(at) && pend.length) {
        out.push({ clave: `pend:${d}`, at, tipo: 'pendientes', titulo: pend.length === 1 ? 'Te queda 1 cosa para hacer' : `Te quedan ${pend.length} cosas para hacer`, cuerpo: pend.slice(0, 3).map((e) => e.titulo).join(' · '), url: '#vida' });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at || (a.clave < b.clave ? -1 : 1));
}

// Texto de los avisos al instante (los arma la base con estos mismos textos).
export function avisoInstante(tipo, { nombre, inicio, modalidad }, ahora) {
  const c = `${cuando(inicio, ahora)} ${horaDe(inicio)} · ${modalidad === 'virtual' ? 'virtual' : 'presencial'}`;
  if (tipo === 'reserva') return { titulo: `Nueva reserva: ${nombre}`, cuerpo: c };
  if (tipo === 'cambio') return { titulo: `${nombre} cambió su turno`, cuerpo: `Ahora: ${c}` };
  if (tipo === 'comprobante') return { titulo: `${nombre} subió el comprobante`, cuerpo: `Revisá la seña · ${c}` };
  return { titulo: nombre, cuerpo: c };
}

// Token secreto para el link "mi turno" (y para la retención del horario).
export function token(n = 24) {
  const b = new Uint8Array(n);
  (globalThis.crypto || {}).getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
