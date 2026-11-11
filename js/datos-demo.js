// =====================================================================
// Modo DEMO: todo vive en este navegador (localStorage), compartido entre
// la página de reservas y el panel. Hace las mismas validaciones que las
// funciones de supabase/schema.sql, así lo que se ve acá es lo que pasa
// con la base real. Todos los nombres y teléfonos son INVENTADOS.
// =====================================================================
import * as L from './logica.js';

const CLAVE = 'agustina-demo-v1';
export const TOKEN_LEJOS = 'demo-turno-lejos-0001';
export const TOKEN_CERCA = 'demo-turno-cerca-0001';
const VENTANA = 30 * 60000;

const AJUSTES = {
  nombre_publico: 'Lic. Agustina Arrieta', profesion: 'Psicóloga', lema: 'Salud mental también es conocimiento', matricula: 'Mat. 11933',
  sena_monto: 10000, alias: 'Licagustina.mp', titular: 'Agustina Arrieta', whatsapp: '351 555-0100', link_videollamada: 'https://meet.google.com/demo-agustina',
  horas_cambio: 24, anticipacion_horas: 12, horizonte_dias: 30, retencion_min: 10,
  recordatorio_horas: [24], recordatorio_texto: L.PLANTILLA_RECORDATORIO, recordatorio_imagen: null, recordatorio_img: { ...L.IMG_RECORDATORIO }, recordatorio_canal: 'whatsapp_manual',
  resumen_hora: '08:00', pendientes_hora: '20:00',
  avisos: { reserva: true, cambio: true, comprobante: true, recordatorios: true, vida: true, resumen: true, pendientes: true },
};
const MODALIDADES = [
  { id: 'presencial', activa: true, duracion: 50, descanso: 10, detalle: 'Consultorio en Nueva Córdoba', orden: 1, horario: { 1: [['09:00', '13:00'], ['15:00', '19:00']], 3: [['09:00', '13:00'], ['15:00', '19:00']], 5: [['09:00', '13:00']] } },
  { id: 'virtual', activa: true, duracion: 50, descanso: 10, detalle: 'Videollamada desde donde estés', orden: 2, horario: { 2: [['17:00', '21:00']], 3: [['19:00', '21:00']], 4: [['17:00', '21:00']] } },
];
const PACIENTES = [
  ['Martina Gómez', '351 555-0111', '1994-04-12'], ['Tomás Rivas', '351 555-0112', '2002-01-30'], ['Lucía Paz', '351 555-0113', '1988-09-05'],
  ['Joaquín Ferrero', '351 555-0114', '1999-07-21'], ['Ana López', '351 555-0115', '1979-02-14'], ['Bruno Sosa', '351 555-0116', '1996-11-02'],
  ['Clara Vega', '351 555-0117', '2004-06-18'], ['Sofía Méndez', '351 555-0118', '2010-05-03'],
];

function guardado() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; } }
function guardar(s) { try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* sin espacio: queda en memoria */ } }

// Agenda de ejemplo armada sobre la grilla real, desde 7 días atrás hasta 12 adelante.
export function generarDemo(ahora = Date.now()) {
  const s = { ajustes: structuredClone(AJUSTES), modalidades: structuredClone(MODALIDADES), servicios: [{ id: 1, nombre: 'Psicoterapia individual', detalle: 'Adolescentes, jóvenes y adultos · desde 15 años', precio: 30000, activo: true, orden: 1 }],
    bloqueos: [], pacientes: [], turnos: [], historial: [], retenciones: [], eventos: [], notificaciones: [], recordatorios: [], suscripciones: [], archivos: {}, sec: 100, ultimoTick: ahora - VENTANA };
  const hoy = L.diaDe(ahora);
  s.pacientes = PACIENTES.map(([nombre, telefono, nacimiento], i) => ({ id: i + 1, nombre, telefono, email: '', nacimiento, responsable_nombre: '', responsable_telefono: '', notas: '', motivo: '', creado_at: ahora - (40 - i) * L.DIA }));
  const sofia = s.pacientes[7];
  Object.assign(sofia, { responsable_nombre: 'Laura Méndez (mamá)', responsable_telefono: '351 555-0199', notas: 'Ansiedad antes de exámenes. Viene con la mamá. Prefiere presencial.', motivo: 'Ansiedad antes de exámenes' });
  s.pacientes[0].notas = 'Trabaja en turno mañana. Prefiere la última hora.';
  s.bloqueos.push({ id: 1, desde: L.sumarDias(hoy, 40), hasta: L.sumarDias(hoy, 52), motivo: 'Vacaciones', modalidad: null });
  const nuevo = (t) => { const x = { id: ++s.sec, token: L.token(18), servicio_id: 1, estado: 'reservado', sena: 'confirmada', comprobante: null, comprobante_at: null, primera_vez: false, motivo: '', origen: 'paciente', cambios: 0, creado_at: t.inicio - 6 * L.DIA, agendado_at: t.inicio - 6 * L.DIA, ...t }; s.turnos.push(x); s.historial.push({ id: ++s.sec, turno_id: x.id, at: x.creado_at, tipo: x.origen === 'paciente' ? 'reserva' : 'creado', detalle: x.origen === 'paciente' ? 'Reservó desde la página' : 'Lo cargaste vos' }); return x; };
  const libre = (ini, fin) => !s.turnos.some((t) => t.inicio < fin && ini < t.fin);

  // Los dos turnos para probar el cambio: uno lejos (más de 24 h) y uno cerca (menos de 24 h).
  const lejosDia = (() => { for (let i = 3; i < 12; i++) { const d = L.sumarDias(hoy, i); if (L.grillaDelDia(s.modalidades[0], d).length) return d; } return L.sumarDias(hoy, 3); })();
  const g = L.grillaDelDia(s.modalidades[0], lejosDia)[1];
  nuevo({ token: TOKEN_LEJOS, paciente_id: 3, modalidad: 'presencial', inicio: g.inicio, fin: g.fin, sena: 'confirmada', comprobante: 'demo/comprobante-ejemplo.svg' });
  const cerca = Math.ceil((ahora + 5 * L.HORA) / L.HORA) * L.HORA;
  nuevo({ token: TOKEN_CERCA, paciente_id: 4, modalidad: 'virtual', inicio: cerca, fin: cerca + 50 * 60000, origen: 'agustina' });
  // Uno para que hoy aparezca el recordatorio a pacientes (24 h antes ya pasó hace un rato).
  const rec = Math.ceil((ahora + 23.5 * L.HORA) / (30 * 60000)) * 30 * 60000;
  if (libre(rec, rec + 50 * 60000)) nuevo({ paciente_id: 1, modalidad: 'presencial', inicio: rec, fin: rec + 50 * 60000, creado_at: ahora - 5 * L.DIA, agendado_at: ahora - 5 * L.DIA });

  let k = 0;
  for (let i = -7; i <= 12; i++) {
    const d = L.sumarDias(hoy, i);
    for (const m of s.modalidades) for (const sl of L.grillaDelDia(m, d)) {
      k++;
      if ((k * 7) % 10 >= 6 || !libre(sl.inicio, sl.fin)) continue; // ~60% ocupado
      const p = s.pacientes[k % 7];
      const t = nuevo({ paciente_id: p.id, modalidad: m.id, inicio: sl.inicio, fin: sl.fin, sena: sl.inicio > ahora && k % 5 === 0 ? 'por_revisar' : 'confirmada', primera_vez: k % 11 === 0 });
      if (t.sena === 'por_revisar') t.comprobante = 'demo/comprobante-ejemplo.svg';
      if (sl.inicio < ahora && k % 9 === 0) t.estado = 'cancelado';
    }
  }
  // Mi vida de ejemplo
  const prox = (dow) => L.sumarDias(hoy, (dow - L.diaSemana(hoy) + 7) % 7);
  s.eventos.push(
    { id: ++s.sec, tipo: 'evento', titulo: 'Yoga', fecha: prox(4), hora_inicio: '07:30', hora_fin: '08:30', repetir: 'semanal', aviso_min: 30, bloquea: false, hecho: false, color: '#2CC253' },
    { id: ++s.sec, tipo: 'evento', titulo: 'Almuerzo con mamá', fecha: L.sumarDias(hoy, 1), hora_inicio: '13:00', hora_fin: '14:30', repetir: 'no', aviso_min: 60, bloquea: false, hecho: false, color: '#FFD60A' },
    { id: ++s.sec, tipo: 'evento', titulo: 'Dentista', fecha: L.sumarDias(hoy, 2), hora_inicio: '15:30', hora_fin: '16:30', repetir: 'no', aviso_min: 30, bloquea: true, hecho: false, color: '#F23A2E' },
    { id: ++s.sec, tipo: 'tarea', titulo: 'Pagar expensas', fecha: hoy, repetir: 'no', aviso_min: null, bloquea: false, hecho: true, color: '#8A4BF2' },
    { id: ++s.sec, tipo: 'tarea', titulo: 'Comprar regalo para Caro', fecha: null, repetir: 'no', aviso_min: null, bloquea: false, hecho: false, color: '#8A4BF2' },
    { id: ++s.sec, tipo: 'tarea', titulo: 'Llamar al contador', fecha: L.sumarDias(hoy, 1), repetir: 'no', aviso_min: null, bloquea: false, hecho: false, color: '#8A4BF2' },
  );
  s.archivos['demo/comprobante-ejemplo.svg'] = COMPROBANTE_EJEMPLO;
  return s;
}

const COMPROBANTE_EJEMPLO = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#fff"/><rect x="0" y="0" width="600" height="160" fill="#00A6E2"/><text x="300" y="95" font-family="Arial" font-size="40" fill="#fff" text-anchor="middle">Transferencia enviada</text><text x="300" y="300" font-family="Arial" font-size="80" fill="#222" text-anchor="middle">$ 10.000</text><text x="60" y="440" font-family="Arial" font-size="28" fill="#666">Para</text><text x="60" y="480" font-family="Arial" font-size="32" fill="#222">Agustina Arrieta · Licagustina.mp</text><text x="60" y="580" font-family="Arial" font-size="28" fill="#666">Comprobante de ejemplo (demo)</text></svg>`);

const err = (m) => { throw new Error(m); };
async function aDataUrl(file) {
  const b = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `data:${file.type};base64,${btoa(bin)}`;
}

export function crearDemo({ reloj = () => Date.now() } = {}) {
  let s = guardado();
  if (!s || !s.ajustes) { s = generarDemo(reloj()); guardar(s); }
  const ahora = () => reloj();
  const recargar = () => { const g = guardado(); if (g && g.ajustes) s = g; };
  const persistir = () => guardar(s);
  const sec = () => ++s.sec;
  const mod = (id) => s.modalidades.find((m) => m.id === id);
  const reglas = () => ({ anticipacionHoras: s.ajustes.anticipacion_horas, horizonteDias: s.ajustes.horizonte_dias });
  const ocup = (excluirTurno, excluirRet, ini, fin) => L.ocupados({ turnos: s.turnos, retenciones: s.retenciones, eventos: s.eventos, excluirTurno, excluirRet, desdeDia: L.sumarDias(L.diaDe(ini), -1), hastaDia: L.diaDe(fin), ahora: ahora() });
  const choca = (ini, fin, exT, exR) => ocup(exT, exR, ini, fin).some((o) => o.inicio < fin && ini < o.fin);
  const slotValido = (m, ini) => L.esSlotValido({ mod: mod(m), inicio: ini, ahora: ahora(), bloqueos: s.bloqueos, ...reglas() });
  const avisar = (tipo, titulo, cuerpo, url, turno_id, clave = null) => {
    if (clave && s.notificaciones.some((n) => n.clave === clave)) return false;
    s.notificaciones.unshift({ id: sec(), tipo, titulo, cuerpo, url, turno_id, clave, creada_at: ahora(), leida: false });
    s.notificaciones = s.notificaciones.slice(0, 150);
    return true;
  };
  const hist = (turno_id, tipo, detalle) => s.historial.push({ id: sec(), turno_id, at: ahora(), tipo, detalle });
  const turnoPorToken = (tk) => (/^[A-Za-z0-9_-]{16,80}$/.test(String(tk || '')) ? s.turnos.find((t) => t.token === tk) : null);
  const pac = (id) => s.pacientes.find((p) => p.id === id) || {};

  // Lo que hace el cron de la función "avisos": arma recordatorios, resumen, Mi vida.
  function tick() {
    const n = ahora();
    const desde = Math.max(s.ultimoTick || n - VENTANA, n - VENTANA);
    const plan = L.planAvisos({ ajustes: s.ajustes, turnos: s.turnos, pacientes: s.pacientes, eventos: s.eventos }, desde - 1, n);
    for (const a of plan) {
      if (!avisar(a.tipo, a.titulo, a.cuerpo, a.url, a.turno_id || null, a.clave)) continue;
      if (a.tipo === 'recordatorio') {
        const t = s.turnos.find((x) => x.id === a.turno_id);
        if (!s.recordatorios.some((r) => r.turno_id === t.id && r.horas === a.horas && r.para === t.inicio)) {
          s.recordatorios.push({ id: sec(), turno_id: t.id, horas: a.horas, para: t.inicio, creado_at: n, estado: 'pendiente', canal: 'whatsapp_manual', enviado_at: null });
        }
      }
    }
    s.ultimoTick = n;
    persistir();
  }

  const publico = {
    async info() {
      recargar();
      const a = s.ajustes, hoy = L.diaDe(ahora());
      return { nombre: a.nombre_publico, profesion: a.profesion, lema: a.lema, matricula: a.matricula, sena: a.sena_monto, alias: a.alias, titular: a.titular, whatsapp: a.whatsapp,
        horas_cambio: a.horas_cambio, anticipacion_horas: a.anticipacion_horas, horizonte_dias: a.horizonte_dias, retencion_min: a.retencion_min,
        servicios: s.servicios.filter((x) => x.activo).sort((x, y) => x.orden - y.orden).map(({ id, nombre, detalle, precio }) => ({ id, nombre, detalle, precio })),
        modalidades: s.modalidades.map(({ id, activa, duracion, descanso, horario, detalle }) => ({ id, activa, duracion, descanso, horario, detalle })),
        bloqueos: s.bloqueos.filter((b) => b.hasta >= hoy).map(({ desde, hasta, modalidad }) => ({ desde, hasta, modalidad })), ahora: ahora() };
    },
    async ocupado(desdeDia, hastaDia, ret) {
      recargar();
      return L.ocupados({ turnos: s.turnos, retenciones: s.retenciones, eventos: s.eventos, excluirRet: ret, desdeDia, hastaDia, ahora: ahora() }).map(({ inicio, fin }) => ({ inicio, fin }));
    },
    async retener(m, inicio, tk) {
      recargar();
      const md = mod(m);
      if (!md || !slotValido(m, inicio)) err('Ese horario ya no está disponible. Elegí otro.');
      const token = /^[A-Za-z0-9_-]{16,80}$/.test(String(tk || '')) ? tk : L.token(18);
      s.retenciones = s.retenciones.filter((r) => r.token !== token && r.expira > ahora() - L.HORA);
      if (choca(inicio, inicio + md.duracion * 60000, null, token)) err('Ese horario se acaba de ocupar. Elegí otro.');
      const expira = ahora() + s.ajustes.retencion_min * 60000;
      s.retenciones.push({ token, modalidad: m, inicio, fin: inicio + md.duracion * 60000, expira });
      persistir();
      return { token, expira };
    },
    async soltar(tk) { recargar(); s.retenciones = s.retenciones.filter((r) => r.token !== tk); persistir(); },
    soltarAlSalir(tk) { try { recargar(); s.retenciones = s.retenciones.filter((r) => r.token !== tk); persistir(); } catch { /* */ } },
    async reservar(ret, d) {
      recargar();
      const r = s.retenciones.find((x) => x.token === ret);
      if (!r) err('Se venció el tiempo para reservar. Elegí el horario de nuevo.');
      const problema = L.validarDatos(d, L.diaDe(ahora()));
      if (problema) err(problema);
      if (!slotValido(r.modalidad, r.inicio) || choca(r.inicio, r.fin, null, r.token)) err('Ese horario se acaba de ocupar. Elegí otro.');
      const tel = L.soloDigitos(d.telefono);
      let p = s.pacientes.find((x) => L.soloDigitos(x.telefono) === tel);
      if (!p) {
        p = { id: sec(), nombre: d.nombre.trim(), telefono: d.telefono, email: d.email || '', nacimiento: d.nacimiento, responsable_nombre: d.responsable_nombre || '', responsable_telefono: d.responsable_telefono || '', notas: '', motivo: d.motivo || '', creado_at: ahora() };
        s.pacientes.push(p);
      } else {
        if (!p.email) p.email = d.email || '';
        if (!p.nacimiento) p.nacimiento = d.nacimiento;
        if (!p.responsable_nombre) p.responsable_nombre = d.responsable_nombre || '';
        if (!p.responsable_telefono) p.responsable_telefono = d.responsable_telefono || '';
        if (s.turnos.filter((t) => t.paciente_id === p.id && t.estado === 'reservado' && t.inicio > ahora() && t.origen === 'paciente').length >= 3) err('Ya tenés turnos reservados. Para sumar otro, escribile a Agustina.');
      }
      const serv = s.servicios.find((x) => x.id === Number(d.servicio_id) && x.activo) || s.servicios.find((x) => x.activo);
      const t = { id: sec(), token: L.token(24), paciente_id: p.id, servicio_id: serv ? serv.id : null, modalidad: r.modalidad, inicio: r.inicio, fin: r.fin, estado: 'reservado', sena: 'pendiente', comprobante: null, comprobante_at: null, primera_vez: !!d.primera_vez, motivo: d.motivo || '', origen: 'paciente', cambios: 0, creado_at: ahora(), agendado_at: ahora() };
      s.turnos.push(t);
      s.retenciones = s.retenciones.filter((x) => x.token !== ret);
      hist(t.id, 'reserva', 'Reservó desde la página');
      const a = L.avisoInstante('reserva', { nombre: p.nombre, inicio: t.inicio, modalidad: t.modalidad }, ahora());
      avisar('reserva', a.titulo, a.cuerpo, `#turno/${t.id}`, t.id);
      persistir();
      return { token: t.token, inicio: t.inicio, fin: t.fin };
    },
    async miTurno(tk) {
      recargar();
      const t = turnoPorToken(tk);
      if (!t) err('No encontramos ese turno.');
      const a = s.ajustes, serv = s.servicios.find((x) => x.id === t.servicio_id), m = mod(t.modalidad);
      return { inicio: t.inicio, fin: t.fin, modalidad: t.modalidad, estado: t.estado, sena: t.sena, comprobante: !!t.comprobante, nombre: L.primerNombre(pac(t.paciente_id).nombre),
        servicio: serv ? serv.nombre : 'Sesión', detalle: m ? m.detalle : '', link_videollamada: t.modalidad === 'virtual' && t.estado === 'reservado' ? a.link_videollamada : '',
        horas_cambio: a.horas_cambio, limite_cambio: L.limiteCambio(t.inicio, a.horas_cambio), puede_cambiar: t.estado === 'reservado' && L.puedeCambiar(t.inicio, ahora(), a.horas_cambio),
        whatsapp: a.whatsapp, alias: a.alias, titular: a.titular, sena_monto: a.sena_monto, ahora: ahora() };
    },
    async cambiarTurno(tk, ret) {
      recargar();
      const t = turnoPorToken(tk);
      if (!t) err('No encontramos ese turno.');
      if (t.estado !== 'reservado') err('Este turno está cancelado. Escribile a Agustina.');
      if (!L.puedeCambiar(t.inicio, ahora(), s.ajustes.horas_cambio)) err(`Faltan menos de ${s.ajustes.horas_cambio} h: ya no se puede cambiar. Escribile a Agustina.`);
      if (t.cambios >= 3) err('Ya cambiaste este turno varias veces. Escribile a Agustina.');
      const r = s.retenciones.find((x) => x.token === ret);
      if (!r) err('Se venció el tiempo. Elegí el horario de nuevo.');
      if (r.modalidad !== t.modalidad) err('El cambio tiene que ser en la misma modalidad.');
      if (!slotValido(r.modalidad, r.inicio) || choca(r.inicio, r.fin, t.id, r.token)) err('Ese horario se acaba de ocupar. Elegí otro.');
      const antes = t.inicio;
      Object.assign(t, { inicio: r.inicio, fin: r.fin, agendado_at: ahora(), cambios: t.cambios + 1 });
      s.retenciones = s.retenciones.filter((x) => x.token !== ret);
      hist(t.id, 'cambio', `Lo cambió el paciente. Antes: ${L.fechaCorta(L.diaDe(antes))} ${L.horaDe(antes)}`);
      const a = L.avisoInstante('cambio', { nombre: pac(t.paciente_id).nombre, inicio: t.inicio, modalidad: t.modalidad }, ahora());
      avisar('cambio', a.titulo, a.cuerpo, `#turno/${t.id}`, t.id);
      persistir();
      return { inicio: t.inicio, fin: t.fin };
    },
    async subirComprobante(tk, file) {
      recargar();
      const t = turnoPorToken(tk);
      if (!t || t.estado !== 'reservado') err('No encontramos ese turno.');
      if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.type)) err('Subí una foto (JPG, PNG) o un PDF.');
      if (file.size > 8 * 1048576) err('El archivo es muy pesado (máximo 8 MB).');
      const dataUrl = await aDataUrl(file);
      const path = `${t.id}/${L.token(9)}.${file.type === 'application/pdf' ? 'pdf' : 'jpg'}`;
      s.archivos[path] = dataUrl.length < 2500000 ? dataUrl : COMPROBANTE_EJEMPLO;
      Object.assign(t, { comprobante: path, comprobante_at: ahora(), sena: t.sena === 'confirmada' ? 'confirmada' : 'por_revisar' });
      hist(t.id, 'comprobante', 'Subió el comprobante');
      const a = L.avisoInstante('comprobante', { nombre: pac(t.paciente_id).nombre, inicio: t.inicio, modalidad: t.modalidad }, ahora());
      avisar('comprobante', a.titulo, a.cuerpo, `#turno/${t.id}`, t.id);
      persistir();
      return path;
    },
    despachar() { tick(); },
  };

  const conId = (lista, obj) => {
    if (obj.id) { const i = lista.findIndex((x) => x.id === obj.id); if (i < 0) err('No existe.'); lista[i] = { ...lista[i], ...obj }; return lista[i]; }
    const n = { ...obj, id: sec() }; lista.push(n); return n;
  };
  const turno = (id) => s.turnos.find((t) => t.id === id) || err('No existe ese turno.');
  const sinPisar = (ini, fin, exT) => { if (s.turnos.some((t) => t.estado === 'reservado' && t.id !== exT && t.inicio < fin && ini < t.fin)) err('Ese horario ya tiene otro turno.'); };

  const panel = {
    async sesion() { return sessionStorage.getItem('agustina-demo-sesion') ? { email: 'lic.agustina.arrieta@gmail.com' } : null; },
    onSesion() { /* demo: nada */ },
    async entrar(email, clave) { if (!email || !clave) err('Escribí tu mail y tu contraseña.'); sessionStorage.setItem('agustina-demo-sesion', '1'); return true; },
    async salir() { sessionStorage.removeItem('agustina-demo-sesion'); return true; },
    async cargar() {
      recargar(); tick();
      return structuredClone({ ajustes: s.ajustes, modalidades: s.modalidades, servicios: s.servicios, bloqueos: s.bloqueos, pacientes: s.pacientes, turnos: s.turnos, historial: s.historial, eventos: s.eventos, notificaciones: s.notificaciones, recordatorios: s.recordatorios, ahora: ahora() });
    },
    async guardarAjustes(p) { recargar(); s.ajustes = { ...s.ajustes, ...p }; persistir(); return true; },
    async guardarModalidad(m) { recargar(); const i = s.modalidades.findIndex((x) => x.id === m.id); if (i < 0) err('Modalidad inválida.'); s.modalidades[i] = { ...s.modalidades[i], ...m }; persistir(); return true; },
    async guardarServicio(x) { recargar(); conId(s.servicios, x); persistir(); return true; },
    async borrarServicio(id) { recargar(); if (s.servicios.filter((x) => x.activo).length <= 1 && s.servicios.find((x) => x.id === id)?.activo) err('Tiene que quedar al menos un servicio.'); s.servicios = s.servicios.filter((x) => x.id !== id); persistir(); return true; },
    async guardarBloqueo(b) { recargar(); if (!b.desde || (b.hasta && b.hasta < b.desde)) err('Revisá las fechas.'); conId(s.bloqueos, { ...b, hasta: b.hasta || b.desde }); persistir(); return true; },
    async borrarBloqueo(id) { recargar(); s.bloqueos = s.bloqueos.filter((x) => x.id !== id); persistir(); return true; },
    async guardarPaciente(p) { recargar(); if (String(p.nombre || '').trim().length < 2) err('Escribí el nombre.'); const r = conId(s.pacientes, p.id ? p : { creado_at: ahora(), notas: '', motivo: '', responsable_nombre: '', responsable_telefono: '', email: '', nacimiento: null, ...p }); persistir(); return r; },
    async borrarPaciente(id) { recargar(); const ids = s.turnos.filter((t) => t.paciente_id === id).map((t) => t.id); s.turnos = s.turnos.filter((t) => t.paciente_id !== id); s.historial = s.historial.filter((h) => !ids.includes(h.turno_id)); s.pacientes = s.pacientes.filter((x) => x.id !== id); persistir(); return true; },
    async crearTurno({ paciente_id, servicio_id, modalidad, inicio, duracion, sena }) {
      recargar();
      const m = mod(modalidad) || err('Modalidad inválida.');
      const fin = inicio + (duracion || m.duracion) * 60000;
      sinPisar(inicio, fin, null);
      const t = { id: sec(), token: L.token(24), paciente_id, servicio_id, modalidad, inicio, fin, estado: 'reservado', sena: sena || 'pendiente', comprobante: null, comprobante_at: null, primera_vez: !s.turnos.some((x) => x.paciente_id === paciente_id), motivo: '', origen: 'agustina', cambios: 0, creado_at: ahora(), agendado_at: ahora() };
      s.turnos.push(t); hist(t.id, 'creado', 'Lo cargaste vos'); persistir(); return t;
    },
    async moverTurno(id, inicio, modalidad) {
      recargar();
      const t = turno(id), dur = t.fin - t.inicio, antes = t.inicio;
      sinPisar(inicio, inicio + dur, id);
      Object.assign(t, { inicio, fin: inicio + dur, modalidad: modalidad || t.modalidad, estado: 'reservado', agendado_at: ahora() });
      hist(id, 'movido', `Lo moviste vos. Antes: ${L.fechaCorta(L.diaDe(antes))} ${L.horaDe(antes)}`); persistir(); return t;
    },
    async cancelarTurno(id, motivo) { recargar(); turno(id).estado = 'cancelado'; hist(id, 'cancelado', motivo || 'Lo cancelaste vos'); persistir(); return true; },
    async senaTurno(id, estado) { recargar(); turno(id).sena = estado; hist(id, 'sena', estado === 'confirmada' ? 'Seña confirmada' : `Seña: ${estado}`); persistir(); return true; },
    async urlComprobante(path) { recargar(); return s.archivos[path] || COMPROBANTE_EJEMPLO; },
    async guardarEvento(e) { recargar(); if (!String(e.titulo || '').trim()) err('Escribí un título.'); const r = conId(s.eventos, e.id ? e : { hecho: false, bloquea: false, repetir: 'no', color: '#8A4BF2', ...e }); persistir(); return r; },
    async borrarEvento(id) { recargar(); s.eventos = s.eventos.filter((x) => x.id !== id); persistir(); return true; },
    async marcarRecordatorio(id, estado = 'enviado') { recargar(); const r = s.recordatorios.find((x) => x.id === id); if (r) Object.assign(r, { estado, enviado_at: ahora() }); persistir(); return true; },
    async leerNotificaciones() { recargar(); s.notificaciones.forEach((n) => { n.leida = true; }); persistir(); return true; },
    async suscribirPush(sub) { recargar(); s.suscripciones = [sub]; persistir(); return true; },
    async probarPush() { recargar(); avisar('prueba', 'Avisos activados', 'Así te van a llegar los avisos de tu agenda.', '#hoy', null); persistir(); return { ok: true, demo: true }; },
    async subirPlantilla(file) { recargar(); const url = await aDataUrl(file); const path = `plantilla/${L.token(9)}`; s.archivos[path] = url; s.ajustes.recordatorio_imagen = path; persistir(); return path; },
    async urlPlantilla(path) { recargar(); return s.archivos[path] || null; },
    tick,
  };

  return {
    modo: 'demo', ahora, publico, panel,
    demo: {
      reiniciar() { s = generarDemo(ahora()); guardar(s); },
      tokens: { lejos: TOKEN_LEJOS, cerca: TOKEN_CERCA },
    },
  };
}
