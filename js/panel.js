// =====================================================================
// Panel de Agustina ("Mi agenda"): Hoy, Semana, Pacientes, Mi vida, Ajustes.
// Rutas con # (#hoy, #dia/2026-11-18, #semana, #pacientes, #paciente/3, #turno/12,
// #recordar/12, #vida, #ajustes, #ajustes/horarios, #notifs…). Los avisos push abren estas rutas.
// =====================================================================
import * as L from './logica.js';
import { esc, ico, emo, hero, toast, copiar, ponerSprite, leerForm, kb } from './ui.js';
import { crearCapaDatos } from './datos.js';
import { dibujarRecordatorio, imagenRecordatorio, PLANTILLA_APP } from './imagen-recordatorio.js';

const $app = document.getElementById('app');
const $capa = document.getElementById('capa');
const CFG = window.AGUSTINA_CONFIG || {};
// Link del mail "elegí tu contraseña" (Supabase lo manda con #...type=recovery).
const RECUPERO = /type=(recovery|invite)/.test(location.hash);
let D, P, S = null;
const ui = { filtroPac: 'todos', buscar: '', vidaFiltro: 'todo', modHorario: 'presencial', hoja: null };

// ---------------------------------------------------------------- ayudas
const ahora = () => D.ahora();
const hoy = () => L.diaDe(ahora());
const pac = (id) => S.pacientes.find((p) => p.id === id) || { nombre: '(sin nombre)', telefono: '' };
const turnoDe = (id) => S.turnos.find((t) => t.id === id);
const mod = (id) => S.modalidades.find((m) => m.id === id);
const servicio = (id) => S.servicios.find((s) => s.id === id);
const activos = () => S.turnos.filter((t) => t.estado === 'reservado');
const delDia = (d) => activos().filter((t) => L.diaDe(t.inicio) === d).sort((a, b) => a.inicio - b.inicio);
const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const COLORES_AV = ['lav', 'mint', 'honey', 'sky', 'peach'];
const avatar = (p) => `<span class="ic ${COLORES_AV[p.id % 5]}" style="font:700 13px Quicksand">${esc(iniciales(p.nombre))}</span>`;
const modTxt = (m) => (m === 'virtual' ? 'Virtual' : 'Presencial');
const senaTxt = (t) => (t.sena === 'confirmada' ? 'seña ok' : t.sena === 'por_revisar' ? 'Revisar comprobante' : 'falta la seña');
const linkReservas = () => new URL('reservar.html', location.href).href;
const linkTurno = (t) => `${linkReservas()}?t=${encodeURIComponent(t.token)}`;
const edadDe = (p) => (p.nacimiento ? L.edad(p.nacimiento, hoy()) : null);
const COLORES_VIDA = ['#FFD60A', '#2F8CF5', '#F23A2E', '#8A4BF2', '#2CC253', '#FF8A1C'];
const AVISOS_VIDA = [[null, 'Sin aviso'], [0, 'A la hora'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [1440, '1 día']];
const avisoTxt = (m) => (m == null ? '' : m === 0 ? 'Aviso a la hora' : m === 1440 ? 'Aviso 1 día antes' : m === 60 ? 'Aviso 1 h antes' : `Aviso ${m} min antes`);

function navBar(activo) {
  const it = (r, i, t) => `<a href="#${r}" class="${activo === r ? 'on' : ''}">${ico(i)}${t}</a>`;
  return `<nav class="nav" aria-label="Secciones"><svg class="bg" viewBox="0 0 360 86" preserveAspectRatio="none" aria-hidden="true"><path d="M0 26H130C150 26 152 2 180 2S210 26 230 26H360V86H0z" fill="#fff"/><path d="M0 26H130C150 26 152 2 180 2S210 26 230 26H360" fill="none" stroke="#EFE9F1" stroke-width="1.5"/></svg>
    <div class="items">${it('hoy', 'home', 'Hoy')}${it('semana', 'cal', 'Semana')}<button class="mid" data-acc="mas" aria-label="${activo === 'vida' ? 'Nuevo evento' : 'Cargar turno'}">${ico('plus')}</button>${it('pacientes', 'users', 'Pacientes')}${it('vida', 'heart', 'Mi vida')}</div></nav>`;
}
const back = (href, txt) => `<a class="pillbtn" href="${href}">${ico('back')}${esc(txt)}</a>`;

// Horarios libres de la grilla para un día (las dos modalidades), sin anticipación (ella puede cargar cuando quiera).
function libresDelDia(d, excluirTurno = null, soloMod = null) {
  const occ = L.ocupados({ turnos: S.turnos, eventos: S.eventos, excluirTurno, desdeDia: L.sumarDias(d, -1), hastaDia: d, ahora: ahora() });
  const out = [];
  for (const m of S.modalidades) {
    if (soloMod && m.id !== soloMod) continue;
    for (const s of L.slotsLibres({ mod: m, dia: d, ahora: ahora(), bloqueos: S.bloqueos, ocupados: occ, anticipacionHoras: 0, horizonteDias: 400 })) out.push({ ...s, modalidad: m.id });
  }
  return out.sort((a, b) => a.inicio - b.inicio);
}
const bloqueoDe = (d) => S.bloqueos.find((b) => d >= b.desde && d <= (b.hasta || b.desde));
const recordatoriosPend = () => S.recordatorios.filter((r) => r.estado === 'pendiente' && (() => { const t = turnoDe(r.turno_id); return t && t.estado === 'reservado' && t.inicio === r.para && t.inicio > ahora(); })());
const noLeidas = () => S.notificaciones.filter((n) => !n.leida).length;

// ---------------------------------------------------------------- pantallas
const V = {};

V.login = () => `${hero({ clase: 'peach', ancho: true, estilo: 'text-align:center;padding-bottom:70px', extra: `<div class="logo-wrap"><img class="logo" src="logo/logo.svg" alt="RESET" width="150" height="54"><div class="logo-sub">Compañía Psicológica</div>
    <div class="sig" style="margin-top:12px"><div class="nm">Lic. Agustina Arrieta</div><div class="pr">Psicóloga</div></div>
    <div style="display:flex;justify-content:center;align-items:flex-end;margin-top:10px">${emo('tristeza', 70)}${emo('alegria', 120)}${emo('ansiedad', 70)}</div></div>` })}
  <div class="body" id="form-login">
    <h2 class="Q" style="margin:0 0 12px">Mi agenda</h2>
    <label class="inp"><small>Mail</small><input data-k="email" type="email" autocomplete="username" value="${D.modo === 'demo' ? 'lic.agustina.arrieta@gmail.com' : ''}"></label>
    <label class="inp"><small>Contraseña</small><input data-k="clave" type="password" autocomplete="current-password" value="${D.modo === 'demo' ? 'demo' : ''}"></label>
    <div id="login-err"></div>
    <button class="cta" data-acc="entrar">Entrar</button>
    ${D.modo === 'demo' ? '<p class="xs muted center" style="margin-top:12px">Modo demo: tocá Entrar (cualquier contraseña).</p>' : ''}
  </div>`;

function filaTurno(t) {
  const p = pac(t.paciente_id), v = t.modalidad === 'virtual';
  const sub = t.sena === 'por_revisar' ? `<span class="xs" style="color:var(--warn);font-weight:800">Revisar comprobante</span>` : `<span class="xs muted">${modTxt(t.modalidad)} · ${senaTxt(t)}</span>`;
  return `<a class="li" href="#turno/${t.id}"><span class="hora">${L.horaDe(t.inicio)}</span><span class="g"><b>${esc(p.nombre)}</b>${t.primera_vez ? ' <span class="tag lav mini">1ª vez</span>' : ''}<br>${sub}</span><span class="ic s ${v ? 'sky' : 'lav'}">${ico(v ? 'video' : 'pin')}</span></a>`;
}

V.hoy = (d = hoy()) => {
  const turnos = delDia(d);
  const libres = libresDelDia(d).filter((s) => s.inicio > ahora());
  const mias = L.ocurrencias(S.eventos.filter((e) => e.tipo !== 'tarea'), d, d);
  const porRevisar = turnos.filter((t) => t.sena === 'por_revisar').length;
  const esHoy = d === hoy();
  const recs = recordatoriosPend();
  const bloq = bloqueoDe(d);
  const cabeza = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="flex:1"><div class="muted sm">Hola,</div><div class="Q b" style="font-size:24px;line-height:1.1">Agustina</div></div>
      <a class="circ" href="#notifs" aria-label="Avisos">${ico('bell')}${noLeidas() ? '<span class="dot"></span>' : ''}</a>
      <a class="circ" href="#semana" aria-label="Semana">${ico('cal')}</a></div>`;
  const navDia = `<div style="display:flex;align-items:center;gap:8px;margin:0 0 12px"><a class="circ" style="width:38px;height:38px" href="#dia/${L.sumarDias(d, -1)}" aria-label="Día anterior">${ico('back')}</a>
      <div class="g center Q b" style="flex:1">${esHoy ? 'Hoy' : esc(L.fechaLarga(d, true))}</div>
      <a class="circ" style="width:38px;height:38px" href="#dia/${L.sumarDias(d, 1)}" aria-label="Día siguiente">${ico('chev')}</a></div>`;
  const recCard = recs.length ? `<a class="card" href="#recordar/${recs[0].turno_id}" style="display:flex;gap:12px;align-items:center;text-decoration:none;background:#E3F3E8;box-shadow:none">
      <span class="ic" style="background:#fff;color:var(--ok)">${ico('chat')}</span><span class="g"><b>${recs.length === 1 ? 'Recordale a ' + esc(L.primerNombre(pac(turnoDe(recs[0].turno_id).paciente_id).nombre)) : `${recs.length} recordatorios para mandar`}</b><br><span class="xs muted">Mensaje + imagen, listos para WhatsApp</span></span>${ico('chev', 'muted')}</a>` : '';
  if (!turnos.length && !mias.length) {
    return `${hero({ clase: 'lav', ancho: true, estilo: 'text-align:center;padding-bottom:64px', extra: `<div class="toprow" style="justify-content:space-between"><a class="circ" href="#dia/${L.sumarDias(d, -1)}" aria-label="Día anterior">${ico('back')}</a><span class="tag">${esc(L.fechaLarga(d, true))}</span><a class="circ" href="#dia/${L.sumarDias(d, 1)}" aria-label="Día siguiente">${ico('chev')}</a></div>
        <div style="display:flex;justify-content:center;align-items:flex-end;margin-top:24px">${emo('tristeza', 150)}${emo('miedo', 84, 'margin-left:-26px')}</div>
        <h1 style="font-size:28px;max-width:none">No hay turnos ${esHoy ? 'hoy' : 'este día'}</h1><p class="hand" style="font-size:23px;margin:4px 0 0">${bloq ? esc(bloq.motivo || 'día bloqueado') : '¡día tranqui, a descansar!'}</p>` })}
      <div class="body">${recCard}
        ${libres.length ? `<div class="card" style="padding:6px 16px"><div class="caps muted" style="margin:8px 0 2px">Libres</div>${libres.slice(0, 6).map((s) => `<button class="li muted" data-acc="nuevo-turno" data-ini="${s.inicio}" data-mod="${s.modalidad}"><span class="hora">${s.hora}</span><span class="g sm">Libre · ${modTxt(s.modalidad)}</span><span class="ic s soft">${ico('plus')}</span></button>`).join('')}</div>` : ''}
        <button class="cta" style="margin-top:0" data-acc="nuevo-turno" data-dia="${d}">${ico('plus')}Cargar turno</button>
        <button class="cta white" style="margin-top:10px" data-acc="copiar-link">${ico('link')}Copiar link de reservas</button>
      </div>${navBar('hoy')}`;
  }
  const filas = [
    ...turnos.map((t) => ({ at: t.inicio, html: filaTurno(t) })),
    ...libres.map((s) => ({ at: s.inicio, html: `<button class="li muted" data-acc="nuevo-turno" data-ini="${s.inicio}" data-mod="${s.modalidad}"><span class="hora">${s.hora}</span><span class="g sm">Libre · ${modTxt(s.modalidad)}</span><span class="ic s soft">${ico('plus')}</span></button>` })),
    ...mias.map((o) => ({ at: o.inicio, html: `<a class="li" href="#vida/${d}"><span class="hora" style="font-size:15px">${o.todoElDia ? 'Día' : L.horaDe(o.inicio)}</span><span class="bar" style="background:${esc(o.evento.color)}"></span><span class="g"><b>${esc(o.evento.titulo)}</b><br><span class="xs muted">Mi vida${o.evento.bloquea ? ' · bloquea pacientes' : ''}</span></span></a>` })),
  ].sort((a, b) => a.at - b.at);
  return `<div class="body" style="padding-top:calc(16px + env(safe-area-inset-top))">${cabeza}
      <div class="card grainy" style="background:linear-gradient(150deg,#C2AEF6,#8A68DE);box-shadow:0 14px 30px rgba(138,104,222,.28);overflow:hidden;min-height:150px;color:#fff"><div>
        <span class="tag" style="color:var(--ink)">${esc(L.fechaLarga(d, true))}</span>
        <div class="Q b" style="font-size:22px;line-height:1.15;margin-top:12px;max-width:170px">${esHoy ? 'Hoy tenés' : 'Tenés'} ${turnos.length} ${turnos.length === 1 ? 'sesión' : 'sesiones'}</div>
        <div class="xs" style="margin-top:4px;opacity:.95">${porRevisar ? `${porRevisar} ${porRevisar === 1 ? 'seña' : 'señas'} por revisar` : 'Señas al día'}${mias.length ? ` · ${mias.length} ${mias.length === 1 ? 'cosa tuya' : 'cosas tuyas'}` : ''}</div>
      </div>${emo('alegria', 120, 'position:absolute;right:-4px;bottom:-8px;z-index:1')}</div>
      ${recCard}${navDia}
      <div class="card" style="padding:6px 16px">${filas.map((f) => f.html).join('')}</div>
    </div>${navBar('hoy')}`;
};

V.semana = (lunes = L.lunesDe(hoy())) => {
  const dias = Array.from({ length: 7 }, (_, i) => L.sumarDias(lunes, i));
  let pres = 0, virt = 0, pend = 0, libres = 0;
  const filas = dias.map((d) => {
    const ts = delDia(d);
    const p = ts.filter((t) => t.modalidad === 'presencial').length, v = ts.length - p, sp = ts.filter((t) => t.sena !== 'confirmada').length;
    const lib = libresDelDia(d).filter((s) => s.inicio > ahora()).length;
    pres += p; virt += v; pend += sp; libres += lib;
    const bl = bloqueoDe(d);
    if (bl) return `<a class="li sm muted" href="#dia/${d}"><span class="Q b" style="width:56px">${esc(L.fechaCorta(d, true))}</span><span class="g" style="display:flex;gap:6px;align-items:center">${ico('ban', '', 'width:16px;height:16px')}Bloqueado · ${esc(bl.motivo || 'sin atención')}</span></a>`;
    if (!ts.length && !lib) return `<a class="li sm muted" href="#dia/${d}"><span class="Q b" style="width:56px">${esc(L.fechaCorta(d, true))}</span><span class="g">—</span></a>`;
    return `<a class="li sm" href="#dia/${d}"><span class="Q b" style="width:56px">${esc(L.fechaCorta(d, true))}</span><span class="g" style="display:flex;gap:4px;flex-wrap:wrap">${p ? `<span class="tag lav">${p} presencial</span>` : ''}${v ? `<span class="tag sky">${v} virtual</span>` : ''}${sp ? `<span class="tag honey">${sp} seña</span>` : ''}</span><span class="muted xs">${lib ? `${lib} ${lib === 1 ? 'libre' : 'libres'}` : ''}</span></a>`;
  });
  const tot = pres + virt + libres || 1;
  const a1 = (pres / tot) * 100, a2 = a1 + (virt / tot) * 100;
  const ocup = Math.round(((pres + virt) / tot) * 100);
  return `<div class="body" style="padding-top:calc(16px + env(safe-area-inset-top))">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <a class="circ" href="#semana/${L.sumarDias(lunes, -7)}" aria-label="Semana anterior">${ico('back')}</a>
        <div style="flex:1;text-align:center"><div class="caps muted">Semana</div><div class="Q b" style="font-size:20px">${Number(lunes.slice(8))} ${L.MESES[Number(lunes.slice(5, 7)) - 1]} – ${Number(dias[6].slice(8))} ${L.MESES[Number(dias[6].slice(5, 7)) - 1]}</div></div>
        <a class="circ" href="#semana/${L.sumarDias(lunes, 7)}" aria-label="Semana siguiente">${ico('chev')}</a>
      </div>
      <div class="card" style="display:flex;gap:14px;align-items:center;background:var(--peach-soft);box-shadow:none">
        <div class="rueda" style="background:conic-gradient(#B49BEA 0 ${a1}%,#9FC0E6 ${a1}% ${a2}%,#F1E6FF ${a2}% 100%)"></div>
        <div style="flex:1;min-width:0">
          <div class="xs muted b">Agenda ocupada</div>
          <div class="num" style="font-size:44px">${ocup}<span style="font-size:22px">%</span></div>
          <div class="xs" style="line-height:1.7"><span style="color:#9F8BD8">●</span> Presencial ${pres} &nbsp;<span style="color:#86A7D2">●</span> Virtual ${virt}<br><span style="color:#E7A93E">●</span> Seña pendiente ${pend} &nbsp;<span style="color:#C9B6F2">●</span> Libre ${libres}</div>
        </div>
      </div>
      <div class="card" style="padding:4px 16px">${filas.join('')}</div>
      ${lunes !== L.lunesDe(hoy()) ? `<a class="cta white" href="#semana">Volver a esta semana</a>` : ''}
    </div>${navBar('semana')}`;
};

V.pacientes = () => {
  const q = ui.buscar.toLowerCase(), qd = L.soloDigitos(ui.buscar);
  const prox = (p) => activos().filter((t) => t.paciente_id === p.id && t.fin > ahora()).sort((a, b) => a.inicio - b.inicio)[0];
  let lista = S.pacientes.filter((p) => !q || p.nombre.toLowerCase().includes(q) || (qd.length >= 3 && L.soloDigitos(p.telefono).includes(qd)));
  if (ui.filtroPac === 'primera') lista = lista.filter((p) => S.turnos.filter((t) => t.paciente_id === p.id && t.estado === 'reservado').length <= 1);
  if (ui.filtroPac === 'menores') lista = lista.filter((p) => { const e = edadDe(p); return e != null && e < 18; });
  if (ui.filtroPac === 'sena') lista = lista.filter((p) => activos().some((t) => t.paciente_id === p.id && t.sena === 'por_revisar'));
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const f = (k, t) => `<button class="tag" data-acc="filtro-pac" data-f="${k}" style="border:0;cursor:pointer;${ui.filtroPac === k ? 'background:var(--ink);color:#fff;box-shadow:none' : ''}">${t}</button>`;
  return `<div class="body" style="padding-top:calc(16px + env(safe-area-inset-top))">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="flex:1"><div class="caps muted">${S.pacientes.length} pacientes</div><div class="Q b" style="font-size:24px">Pacientes</div></div>
        <button class="circ" style="color:var(--orange)" data-acc="nuevo-paciente" aria-label="Nuevo paciente">${ico('plus')}</button>
      </div>
      <label class="pillbtn" style="display:flex;padding:8px 16px;letter-spacing:.04em;text-transform:none;font-size:15px;font-weight:600">${ico('search')}<input id="buscar" type="search" placeholder="Buscar por nombre o teléfono" value="${esc(ui.buscar)}" style="border:0;outline:0;flex:1;min-width:0;background:transparent;font:600 15px Nunito"></label>
      <div style="display:flex;gap:6px;margin:14px 0 10px;flex-wrap:wrap">${f('todos', 'Todos')}${f('primera', '1ª vez')}${f('menores', 'Menores')}${f('sena', 'Seña por revisar')}</div>
      ${lista.length ? `<div class="card" style="padding:4px 16px">${lista.map((p) => {
        const t = prox(p), e = edadDe(p), rev = activos().some((x) => x.paciente_id === p.id && x.sena === 'por_revisar');
        return `<a class="li" href="#paciente/${p.id}">${avatar(p)}<span class="g"><b>${esc(p.nombre)}</b>${e != null && e < 18 ? ` <span class="tag honey mini">${e} años</span>` : ''}<br>${rev ? '<span class="xs" style="color:var(--warn);font-weight:800">Seña por revisar</span>' : `<span class="xs muted">${t ? `Próx. ${esc(L.fechaCorta(L.diaDe(t.inicio)))} · ${L.horaDe(t.inicio)}${t.modalidad === 'virtual' ? ' · virtual' : ''}` : 'Sin turno próximo'}</span>`}</span>${ico('chev', 'muted')}</a>`;
      }).join('')}</div>` : `<div class="vacio">${emo('desagrado', 110)}<h3>${S.pacientes.length ? 'No encontré a nadie' : 'Todavía no hay pacientes'}</h3><p class="sm muted">Se crean solos cuando reservan, o los cargás con el +.</p></div>`}
    </div>${navBar('pacientes')}`;
};

V.paciente = (id) => {
  const p = S.pacientes.find((x) => x.id === Number(id));
  if (!p) return V.noExiste('#pacientes', 'Pacientes');
  const e = edadDe(p);
  const ts = S.turnos.filter((t) => t.paciente_id === p.id).sort((a, b) => b.inicio - a.inicio);
  const desde = new Date(p.creado_at || ahora());
  const histTxt = (t) => {
    const h = S.historial.filter((x) => x.turno_id === t.id).map((x) => x.tipo);
    if (t.estado === 'cancelado') return ['Cancelado', 'rojo'];
    if (t.inicio > ahora()) return ['Próxima', 'peach'];
    if (h.includes('cambio') || h.includes('movido')) return ['Movido', ''];
    return ['Hecha', 'gris'];
  };
  const wa = L.linkWa(p.telefono, `Hola ${L.primerNombre(p.nombre)}! `);
  return `${hero({ clase: 'lav', ancho: true, arriba: `<div class="toprow">${back('#pacientes', 'Pacientes')}<button class="pillbtn" data-acc="editar-paciente" data-id="${p.id}">${ico('edit')}Editar</button></div>`, titulo: esc(p.nombre), sub: `${e != null ? `${e} años · ` : ''}desde ${L.MESES_LARGOS[desde.getMonth()]} ${desde.getFullYear()} · ${ts.filter((t) => t.estado === 'reservado' && t.inicio < ahora()).length} sesiones`,
      extra: `<div style="display:flex;gap:8px;margin-top:12px">${p.telefono ? `<a class="circ" style="width:40px;height:40px;color:var(--ok)" href="${wa}" target="_blank" rel="noopener" aria-label="WhatsApp">${ico('chat')}</a><a class="circ" style="width:40px;height:40px" href="tel:${esc(L.soloDigitos(p.telefono))}" aria-label="Llamar">${ico('phone')}</a>` : ''}${p.email ? `<a class="circ" style="width:40px;height:40px" href="mailto:${esc(p.email)}" aria-label="Mail">${ico('mail')}</a>` : ''}</div>`, estilo: 'padding-bottom:56px' })}
    <div class="body">
      ${p.responsable_nombre ? `<div class="card aviso" style="margin-bottom:14px"><span class="caps" style="color:var(--warn)">Adulto responsable</span><div class="sm">${esc(p.responsable_nombre)} · ${esc(p.responsable_telefono)}</div></div>` : ''}
      <div class="card" style="padding:14px 16px">
        <div class="caps" style="display:flex;gap:6px;align-items:center;color:#6E58B0">${ico('lock', '', 'width:14px;height:14px')}Notas privadas</div>
        ${p.motivo ? `<p class="xs muted" style="margin:6px 0 0"><b>Motivo (lo escribió al reservar):</b> ${esc(p.motivo)}</p>` : ''}
        <textarea id="notas" data-id="${p.id}" class="sm" style="width:100%;min-height:90px;border:0;background:var(--soft);border-radius:16px;padding:10px 12px;margin-top:8px;resize:vertical;font-size:15px" placeholder="Solo vos ves esto.">${esc(p.notas || '')}</textarea>
        <button class="cta chico white" style="margin-top:8px" data-acc="guardar-notas" data-id="${p.id}">Guardar notas</button>
      </div>
      <div class="card" style="padding:4px 16px">
        <div class="li sm" style="cursor:default"><span class="g muted">WhatsApp</span><b>${esc(p.telefono || '—')}</b></div>
        <div class="li sm" style="cursor:default"><span class="g muted">Mail</span><b class="wrapword">${esc(p.email || '—')}</b></div>
        <div class="li sm" style="cursor:default"><span class="g muted">Nacimiento</span><b>${p.nacimiento ? esc(p.nacimiento.split('-').reverse().join('/')) : '—'}</b></div>
      </div>
      <button class="cta" style="margin:0 0 14px" data-acc="nuevo-turno" data-pac="${p.id}">${ico('plus')}Turno para ${esc(L.primerNombre(p.nombre))}</button>
      <div class="caps muted" style="margin:0 6px 8px">Historial</div>
      ${ts.length ? `<div class="card" style="padding:4px 16px">${ts.map((t) => { const [tx, c] = histTxt(t); return `<a class="li sm" href="#turno/${t.id}"><span class="g"><b>${esc(L.fechaCorta(L.diaDe(t.inicio), true))} ${L.MESES[Number(L.diaDe(t.inicio).slice(5, 7)) - 1]} · ${L.horaDe(t.inicio)}</b><br><span class="xs muted">${modTxt(t.modalidad)} · ${senaTxt(t)}</span></span><span class="tag ${c}">${tx}</span></a>`; }).join('')}</div>` : '<p class="sm muted" style="margin:0 6px">Sin turnos todavía.</p>'}
    </div>${navBar('pacientes')}`;
};

V.turno = (id) => {
  const t = turnoDe(Number(id));
  if (!t) return V.noExiste('#hoy', 'Hoy');
  const p = pac(t.paciente_id), e = edadDe(p);
  const n = S.turnos.filter((x) => x.paciente_id === p.id && x.estado === 'reservado' && x.inicio <= t.inicio).length;
  const h = S.historial.filter((x) => x.turno_id === t.id).sort((a, b) => a.at - b.at);
  const cancel = t.estado === 'cancelado';
  const tag = cancel ? '<span class="tag rojo">Cancelado</span>' : t.sena === 'confirmada' ? '<span class="tag mint">Confirmada</span>' : t.sena === 'por_revisar' ? '<span class="tag honey">Por revisar</span>' : '<span class="tag gris">Sin comprobante</span>';
  return `${hero({ clase: 'peach', arriba: `<div class="toprow">${back(`#dia/${L.diaDe(t.inicio)}`, L.diaDe(t.inicio) === hoy() ? 'Hoy' : L.fechaCorta(L.diaDe(t.inicio), true))}${p.telefono ? `<a class="circ" style="width:40px;height:40px;color:var(--ok)" href="${L.linkWa(p.telefono)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ico('chat')}</a>` : ''}</div>
      <div class="caps" style="opacity:.7;margin-top:14px">${esc(L.fechaLarga(L.diaDe(t.inicio), true))} · ${L.horaDe(t.inicio)} · ${modTxt(t.modalidad)}</div>`, titulo: `<a href="#paciente/${p.id}" style="text-decoration:none">${esc(p.nombre)}</a>`, sub: `${e != null ? `${e} años · ` : ''}${n}ª sesión${t.primera_vez ? ' · primera vez' : ''}`, personaje: 'desagrado', tam: 96, estilo: 'padding-bottom:56px' })}
    <div class="body">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="caps muted">Seña</span>${tag}</div>
        ${t.comprobante ? `<button data-acc="ver-comprobante" data-path="${esc(t.comprobante)}" style="display:block;width:100%;border:0;cursor:pointer;margin:10px 0 8px;background:var(--soft);border-radius:22px;padding:14px;text-align:left">
            <div style="display:flex;gap:12px;align-items:center"><span class="ic sky" style="width:46px;height:56px;border-radius:14px">${ico('receipt')}</span>
            <div><div class="xs muted">Comprobante de transferencia</div><div><span class="muted sm">$</span> <span class="num" style="font-size:30px">${L.precio(S.ajustes.sena_monto)}</span></div><div class="xs muted">${t.comprobante_at ? `Subido ${esc(L.fechaCorta(L.diaDe(t.comprobante_at)))} ${L.horaDe(t.comprobante_at)} · ` : ''}tocá para verlo</div></div></div></button>`
          : `<p class="sm muted" style="margin:10px 0 0">${t.origen === 'agustina' ? 'Turno cargado por vos.' : 'Todavía no subió el comprobante.'}</p>`}
      </div>
      ${!cancel && t.sena !== 'confirmada' ? `<button class="cta" style="margin-top:0" data-acc="sena-ok" data-id="${t.id}">${ico('check')}Marcar seña confirmada</button>` : ''}
      ${!cancel && t.sena === 'confirmada' ? `<button class="cta white" style="margin-top:0" data-acc="sena-pend" data-id="${t.id}">Desmarcar seña</button>` : ''}
      <div class="fila2" style="margin-top:10px">
        <button class="cta white chico" data-acc="mover" data-id="${t.id}">${ico('swap')}${cancel ? 'Reactivar' : 'Mover'}</button>
        ${cancel ? '<span></span>' : `<button class="cta rojo chico" data-acc="cancelar" data-id="${t.id}">${ico('ban')}Cancelar</button>`}
      </div>
      ${!cancel ? `<div class="fila2" style="margin-top:8px">
        <a class="cta wa chico" href="#recordar/${t.id}">${ico('bell')}Recordatorio</a>
        <button class="cta white chico" data-acc="mandar-link" data-id="${t.id}">${ico('link')}Su link</button></div>` : ''}
      ${t.motivo ? `<div class="card flat" style="margin-top:14px"><div class="caps" style="display:flex;gap:6px;align-items:center;color:#6E58B0">${ico('lock', '', 'width:14px;height:14px')}Motivo</div><p class="sm" style="margin:6px 0 0">${esc(t.motivo)}</p></div>` : ''}
      ${h.length ? `<div class="caps muted" style="margin:18px 6px 8px">Movimientos</div><div class="card" style="padding:4px 16px">${h.map((x) => `<div class="li sm" style="cursor:default"><span class="g">${esc(x.detalle)}</span><span class="xs muted">${esc(L.fechaCorta(L.diaDe(x.at)))} ${L.horaDe(x.at)}</span></div>`).join('')}</div>` : ''}
    </div>`;
};

V.noExiste = (href, txt) => `${hero({ clase: 'lav', ancho: true, arriba: back(href, txt), titulo: 'No lo encontré', sub: 'Puede que se haya borrado.', personaje: 'miedo' })}<div class="body"></div>`;

// Pantalla del recordatorio: imagen + mensaje listos para WhatsApp.
V.recordar = (id) => {
  const t = turnoDe(Number(id));
  if (!t) return V.noExiste('#hoy', 'Hoy');
  const p = pac(t.paciente_id);
  const rec = S.recordatorios.filter((r) => r.turno_id === t.id && r.para === t.inicio).sort((a, b) => b.id - a.id)[0];
  const texto = L.textoRecordatorio(t, p, S.ajustes);
  const otros = recordatoriosPend().filter((r) => r.turno_id !== t.id);
  return `${hero({ clase: 'mix', arriba: `<div class="toprow">${back(`#turno/${t.id}`, 'Turno')}${rec ? `<span class="tag ${rec.estado === 'enviado' ? 'mint' : 'honey'}">${rec.estado === 'enviado' ? 'Enviado' : 'Pendiente'}</span>` : ''}</div>`, titulo: `Recordale a ${esc(L.primerNombre(p.nombre))}`, sub: `${esc(L.cuando(t.inicio, ahora()))} ${L.horaDe(t.inicio)} · ${modTxt(t.modalidad).toLowerCase()}`, personaje: 'alegria', tam: 104, estilo: 'padding-bottom:52px' })}
    <div class="body">
      <canvas id="img-rec" class="preview-img" aria-label="Imagen del recordatorio" style="aspect-ratio:1122/1402"></canvas>
      <label class="inp" style="margin-top:12px"><small>Mensaje</small><textarea id="txt-rec" rows="6">${esc(texto)}</textarea></label>
      ${p.telefono ? '' : '<div class="card aviso sm">No tiene WhatsApp cargado: el mensaje se comparte y elegís el chat.</div>'}
      <button class="cta" style="margin-top:4px" data-acc="compartir-rec" data-id="${t.id}">${ico('chat')}Mandar por WhatsApp</button>
      <div class="fila2" style="margin-top:10px">
        <button class="cta white chico" data-acc="guardar-img" data-id="${t.id}">${ico('download')}Guardar imagen</button>
        ${p.telefono ? `<button class="cta white chico" data-acc="abrir-chat" data-id="${t.id}">${ico('chat')}Abrir su chat</button>` : '<span></span>'}
      </div>
      ${rec && rec.estado !== 'enviado' ? `<button class="cta white" style="margin-top:10px" data-acc="rec-enviado" data-id="${rec.id}">${ico('check')}Ya se lo mandé</button>` : ''}
      <p class="xs muted" style="margin:12px 6px 0">“Mandar por WhatsApp” abre el menú de compartir con la imagen y el texto: elegí WhatsApp y el chat de ${esc(L.primerNombre(p.nombre))}. El texto también queda copiado, por si WhatsApp no lo pega.</p>
      ${otros.length ? `<div class="caps muted" style="margin:18px 6px 8px">Otros para mandar</div><div class="card" style="padding:4px 16px">${otros.map((r) => { const x = turnoDe(r.turno_id); return `<a class="li sm" href="#recordar/${x.id}"><span class="g"><b>${esc(pac(x.paciente_id).nombre)}</b><br><span class="xs muted">${esc(L.cuando(x.inicio, ahora()))} ${L.horaDe(x.inicio)}</span></span>${ico('chev', 'muted')}</a>`; }).join('')}</div>` : ''}
    </div>`;
};

V.vida = (d = hoy()) => {
  const f = ui.vidaFiltro;
  const mias = f === 'trabajo' ? [] : L.ocurrencias(S.eventos.filter((e) => e.tipo !== 'tarea'), d, d);
  const ts = f === 'vida' ? [] : delDia(d);
  const tareas = S.eventos.filter((e) => e.tipo === 'tarea' && (!e.fecha || e.fecha <= d || e.fecha === d)).sort((a, b) => Number(a.hecho) - Number(b.hecho));
  const filas = [
    ...mias.map((o) => ({ at: o.inicio, html: `<button class="li" data-acc="editar-evento" data-id="${o.evento.id}"><span class="hora" style="font-size:15px">${o.todoElDia ? 'Día' : L.horaDe(o.inicio)}</span><span class="bar" style="background:${esc(o.evento.color)}"></span><span class="g"><b>${esc(o.evento.titulo)}</b><br><span class="xs muted">${[o.evento.repetir === 'semanal' ? `Cada ${L.DIAS_LARGOS[L.diaSemana(o.evento.fecha)]}` : '', avisoTxt(o.evento.aviso_min)].filter(Boolean).join(' · ') || 'Sin aviso'}</span></span>${o.evento.bloquea ? `<span class="tag peach mini">${ico('lock', '', 'width:11px;height:11px')} Bloquea</span>` : ''}</button>` })),
  ];
  if (ts.length) {
    const grupos = [];
    for (const t of ts) { const g = grupos[grupos.length - 1]; if (g && t.inicio - g.fin <= 15 * 60000 && g.mod === t.modalidad) { g.n++; g.fin = t.fin; } else grupos.push({ ini: t.inicio, fin: t.fin, n: 1, mod: t.modalidad }); }
    for (const g of grupos) filas.push({ at: g.ini, html: `<a class="li" href="#dia/${d}"><span class="hora" style="font-size:15px">${L.horaDe(g.ini)}</span><span class="bar" style="background:#8A4BF2"></span><span class="g"><b>${g.n} ${g.n === 1 ? 'sesión' : 'sesiones'} · ${L.horaDe(g.ini)} a ${L.horaDe(g.fin)}</b><br><span class="xs muted">Trabajo · ${g.mod}</span></span><span class="tag lav mini">Trabajo</span></a>` });
  }
  filas.sort((a, b) => a.at - b.at);
  const hechas = tareas.filter((x) => x.hecho).length;
  return `${hero({ clase: 'lav', arriba: `<div class="toprow"><span style="display:flex;gap:6px;align-items:center"><a class="circ" style="width:34px;height:34px" href="#vida/${L.sumarDias(d, -1)}" aria-label="Día anterior">${ico('back')}</a><span class="tag">${esc(L.fechaLarga(d, true))}</span><a class="circ" style="width:34px;height:34px" href="#vida/${L.sumarDias(d, 1)}" aria-label="Día siguiente">${ico('chev')}</a></span></div>`, titulo: 'Mi vida', sub: `${ico('lock', '', 'width:13px;height:13px;vertical-align:-2px')} Solo vos ves esto`, personaje: 'alegria', tam: 128, estilo: 'padding-bottom:52px' })}
    <div class="body">
      <div class="seg">${[['todo', 'Todo'], ['trabajo', 'Trabajo'], ['vida', 'Mi vida']].map(([k, t]) => `<button data-acc="vida-filtro" data-f="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${filas.length ? `<div class="card" style="padding:4px 16px">${filas.map((x) => x.html).join('')}</div>` : `<div class="card flat center sm muted">Nada ${f === 'trabajo' ? 'de trabajo' : 'agendado'} este día.</div>`}
      ${f !== 'trabajo' ? `<div class="card" style="padding:12px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span class="caps muted">Para hacer</span><span class="xs muted">${hechas} de ${tareas.length}</span></div>
        ${tareas.map((x) => `<div class="li sm"><button class="chk ${x.hecho ? 'done' : ''}" data-acc="tarea-hecha" data-id="${x.id}" aria-label="Marcar">${x.hecho ? ico('check') : ''}</button><button class="g" data-acc="editar-evento" data-id="${x.id}" style="border:0;background:none;text-align:left;cursor:pointer;padding:0;${x.hecho ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.titulo)}${x.fecha && x.fecha < d && !x.hecho ? ' <span class="tag honey mini">atrasada</span>' : ''}</button></div>`).join('') || '<p class="sm muted" style="margin:4px 0">Nada pendiente.</p>'}
        <button class="cta chico white" style="margin-top:8px" data-acc="nuevo-evento" data-tipo="tarea" data-dia="${d}">${ico('plus')}Agregar</button>
      </div>` : ''}
    </div>${navBar('vida')}`;
};

V.notifs = () => {
  const ns = S.notificaciones;
  const icono = { reserva: 'cal', cambio: 'swap', comprobante: 'receipt', recordatorio: 'chat', vida: 'heart', resumen: 'home', pendientes: 'list', prueba: 'bell' };
  return `${hero({ clase: 'soft', arriba: back('#hoy', 'Hoy'), titulo: 'Avisos', sub: 'Lo último que pasó en tu agenda.', personaje: 'tristeza', tam: 96, estilo: 'padding-bottom:52px' })}
    <div class="body">${ns.length ? `<div class="card" style="padding:4px 16px">${ns.slice(0, 60).map((n) => `<a class="li" href="${esc(n.url || '#hoy')}"><span class="ic s ${n.leida ? 'soft' : 'lav'}">${ico(icono[n.tipo] || 'bell')}</span><span class="g"><b>${esc(n.titulo)}</b><br><span class="xs muted">${esc(n.cuerpo)}</span></span><span class="xs muted">${esc(L.fechaCorta(L.diaDe(n.creada_at)))} ${L.horaDe(n.creada_at)}</span></a>`).join('')}</div>` : `<div class="vacio">${emo('alegria', 110)}<h3>Sin avisos</h3></div>`}</div>`;
};

V.ajustes = () => `${hero({ clase: 'peach', arriba: '<span class="caps" style="opacity:.7">Ajustes</span>', titulo: 'Tu consultorio', personaje: 'enojo', tam: 92, estilo: 'padding-bottom:52px' })}
  <div class="body">
    <div class="card" style="padding:4px 16px">
      <a class="li" href="#ajustes/servicio"><span class="ic s lav">${ico('heart')}</span><span class="g"><b>Servicio y seña</b><br><span class="xs muted">Precios, seña, alias, WhatsApp, videollamada</span></span>${ico('chev', 'muted')}</a>
      <a class="li" href="#ajustes/horarios"><span class="ic s sky">${ico('clock')}</span><span class="g"><b>Horarios</b><br><span class="xs muted">Presencial y virtual, duración, días bloqueados</span></span>${ico('chev', 'muted')}</a>
      <a class="li" href="#ajustes/recordatorio"><span class="ic s mint">${ico('chat')}</span><span class="g"><b>Recordatorio a pacientes</b><br><span class="xs muted">${S.ajustes.recordatorio_horas.length ? S.ajustes.recordatorio_horas.map((h) => (h === 24 ? '1 día' : `${h} h`)).join(' y ') + ' antes' : 'Apagado'} · mensaje e imagen</span></span>${ico('chev', 'muted')}</a>
      <a class="li" href="#ajustes/avisos"><span class="ic s honey">${ico('bell')}</span><span class="g"><b>Avisos al celu</b><br><span class="xs muted">Reservas, cambios, comprobantes, Mi vida, resumen</span></span>${ico('chev', 'muted')}</a>
    </div>
    <div class="card grainy" style="background:linear-gradient(150deg,#F3EEFF,#D9CCF8);box-shadow:none"><div>
      <span class="caps" style="opacity:.7">Mi link de reservas</span>
      <div class="Q b wrapword" style="font-size:15px;margin:4px 0 10px">${esc(linkReservas())}</div>
      <div class="fila2"><button class="pillbtn" style="justify-content:center" data-acc="copiar-link">${ico('copy')}Copiar</button><button class="pillbtn" style="justify-content:center;color:var(--ok)" data-acc="compartir-link">${ico('chat')}WhatsApp</button></div>
    </div></div>
    <div class="li sm" style="cursor:default"><img src="iconos/icono-180.png" alt="" width="52" height="52" style="border-radius:14px;box-shadow:var(--shadow-sm)"><span class="g"><b>Ícono en tu celu</b><br><span class="xs muted">Safari → Compartir → Agregar a inicio.</span></span></div>
    <button class="cta white" data-acc="salir">${ico('logout')}Cerrar sesión</button>
    ${D.modo === 'demo' ? '<button class="cta white" style="margin-top:10px" data-acc="reiniciar-demo">Reiniciar la demo</button>' : ''}
    <div class="sig" style="margin-top:22px"><div class="nm" style="font-size:20px">${esc(S.ajustes.nombre_publico)}</div><div class="pr" style="font-size:9px">${esc(S.ajustes.profesion)} · ${esc(S.ajustes.matricula || '')}</div></div>
  </div>${navBar('ajustes')}`;

V['ajustes/servicio'] = () => {
  const a = S.ajustes;
  const campo = (k, t, tipo = 'text', extra = '') => `<label class="inp"><small>${t}</small><input data-k="${k}" type="${tipo}" value="${esc(a[k] ?? '')}" ${extra}></label>`;
  return `${hero({ clase: 'peach', arriba: back('#ajustes', 'Ajustes'), titulo: 'Servicio y seña', personaje: 'enojo', tam: 92, estilo: 'padding-bottom:52px' })}
    <div class="body">
      ${S.servicios.filter((s) => s.activo).map((s) => `<button class="card" data-acc="editar-servicio" data-id="${s.id}" style="display:block;width:100%;text-align:left;border:0;cursor:pointer">
        <div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(s.nombre)}</b>${ico('edit', 'muted')}</div><div class="xs muted">${esc(s.detalle)}</div>
        <div style="text-align:right;margin-top:8px"><span class="muted xs">$</span> <span class="num" style="font-size:32px">${L.precio(s.precio)}</span></div></button>`).join('')}
      <button class="pillbtn" style="display:flex;justify-content:center;margin:0 auto 14px" data-acc="editar-servicio">${ico('plus')}Agregar servicio</button>
      <div class="card" id="form-ajustes">
        ${campo('sena_monto', 'Seña ($)', 'number', 'min="0" step="500" inputmode="numeric"')}
        ${campo('alias', 'Alias')}${campo('titular', 'Titular de la cuenta')}
        <div class="fila2">${campo('horas_cambio', 'Cambios hasta (h antes)', 'number', 'min="0" max="168"')}${campo('anticipacion_horas', 'Reservar con (h antes)', 'number', 'min="0" max="168"')}</div>
        ${campo('horizonte_dias', 'Se puede reservar hasta (días)', 'number', 'min="1" max="120"')}
        ${campo('whatsapp', 'Mi WhatsApp', 'tel')}${campo('link_videollamada', 'Link de videollamada', 'url')}
        ${campo('nombre_publico', 'Nombre que ven')}${campo('matricula', 'Matrícula')}
        <button class="cta" style="margin-top:4px" data-acc="guardar-ajustes" data-form="form-ajustes">Guardar</button>
      </div>
    </div>${navBar('ajustes')}`;
};

V['ajustes/horarios'] = () => {
  const m = mod(ui.modHorario);
  const dia = (n) => {
    const r = (m.horario || {})[String(n)] || [];
    return `<button class="li sm${r.length ? '' : ' muted'}" data-acc="editar-dia" data-d="${n}"><span class="toggle ${r.length ? 'on' : ''}" aria-hidden="true"></span><b style="width:34px">${L.DIAS_CORTOS[n].replace(/^./, (c) => c.toUpperCase())}</b><span class="g">${r.length ? r.map(([x, y]) => `${x}–${y}`).join(' · ') : '—'}</span>${ico('edit', 'muted')}</button>`;
  };
  const bls = S.bloqueos.filter((b) => (b.hasta || b.desde) >= hoy()).sort((a, b) => (a.desde < b.desde ? -1 : 1));
  return `${hero({ clase: 'lav', arriba: back('#ajustes', 'Ajustes'), titulo: 'Horarios', personaje: 'alegria', tam: 96, estilo: 'padding-bottom:52px' })}
    <div class="body">
      <div class="seg">${S.modalidades.map((x) => `<button data-acc="mod-horario" data-id="${x.id}" class="${x.id === m.id ? 'on' : ''}">${modTxt(x.id)}</button>`).join('')}</div>
      <div class="card" style="padding:4px 16px">
        <div class="li sm" style="cursor:default"><span class="g"><b>${modTxt(m.id)} activa</b><br><span class="xs muted">Si la apagás, no aparece en la página de reservas.</span></span><button class="toggle ${m.activa ? 'on' : ''}" data-acc="mod-activa" aria-label="Activa"></button></div>
        ${[1, 2, 3, 4, 5, 6, 7].map(dia).join('')}
      </div>
      <div class="card" id="form-mod">
        <div class="fila2"><label class="inp"><small>Duración (min)</small><input data-k="duracion" type="number" min="15" max="240" value="${m.duracion}"></label><label class="inp"><small>Descanso (min)</small><input data-k="descanso" type="number" min="0" max="120" value="${m.descanso}"></label></div>
        <label class="inp"><small>${m.id === 'virtual' ? 'Detalle (ej.: por Meet)' : 'Dirección o barrio'}</small><input data-k="detalle" value="${esc(m.detalle)}" maxlength="120"></label>
        <button class="cta chico" data-acc="guardar-mod">Guardar ${modTxt(m.id).toLowerCase()}</button>
      </div>
      <div class="caps muted" style="margin:6px 6px 8px">Días bloqueados (vacaciones, feriados)</div>
      <div class="card" style="padding:4px 16px">
        ${bls.map((b) => `<div class="li sm"><span class="ic s peach">${ico('ban')}</span><span class="g"><b>${esc(b.desde === (b.hasta || b.desde) ? L.fechaCorta(b.desde, true) + ' ' + L.MESES[Number(b.desde.slice(5, 7)) - 1] : `${Number(b.desde.slice(8))} ${L.MESES[Number(b.desde.slice(5, 7)) - 1]} – ${Number(b.hasta.slice(8))} ${L.MESES[Number(b.hasta.slice(5, 7)) - 1]}`)}</b> · ${esc(b.motivo || 'sin atención')}${b.modalidad ? ` · solo ${b.modalidad}` : ''}</span><button class="circ" style="width:34px;height:34px" data-acc="borrar-bloqueo" data-id="${b.id}" aria-label="Quitar">${ico('trash')}</button></div>`).join('') || '<p class="sm muted" style="margin:10px 0">Ninguno por ahora.</p>'}
        <button class="cta chico white" style="margin:6px 0 10px" data-acc="nuevo-bloqueo">${ico('plus')}Bloquear días</button>
      </div>
    </div>${navBar('ajustes')}`;
};

V['ajustes/avisos'] = () => {
  const av = S.ajustes.avisos || {};
  const tg = (k, t, sub = '') => `<div class="li sm" style="cursor:default"><span class="g">${t}${sub ? `<br><span class="xs muted">${sub}</span>` : ''}</span><button class="toggle ${av[k] !== false ? 'on' : ''}" data-acc="aviso" data-k="${k}" aria-label="${esc(t)}"></button></div>`;
  const soporta = 'serviceWorker' in navigator && 'PushManager' in window;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  return `<div class="body" style="padding-top:calc(16px + env(safe-area-inset-top))">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><a class="circ" href="#ajustes" aria-label="Ajustes">${ico('back')}</a><div style="flex:1"><div class="caps muted">Ajustes</div><div class="Q b" style="font-size:22px">Avisos al celu</div></div></div>
      <div class="card grainy" style="background:linear-gradient(150deg,#F3EEFF,#D9CCF8);box-shadow:none;padding:14px"><div>
        <div style="display:flex;gap:10px;align-items:center"><img src="iconos/icono-180.png" alt="" width="38" height="38" style="border-radius:11px;flex:none"><div class="g sm" style="flex:1"><div class="xs muted">Mi agenda · ahora</div><b>Nueva reserva: Sofía</b><br><span class="xs">mañana 10:00 · presencial</span></div></div>
        <div id="estado-push" class="sm" style="margin-top:12px">${!soporta ? 'Este navegador no recibe avisos. En iPhone: abrí la app desde el ícono de inicio.' : perm === 'granted' ? 'Avisos permitidos en este celu.' : perm === 'denied' ? 'Bloqueaste los avisos: activalos en Ajustes del iPhone → Notificaciones → Mi agenda.' : 'Todavía no activaste los avisos en este celu.'}</div>
        ${soporta ? `<div class="fila2" style="margin-top:10px"><button class="pillbtn" style="justify-content:center" data-acc="activar-push">${ico('bell')}Activar</button><button class="pillbtn" style="justify-content:center" data-acc="probar-push">Probar</button></div>` : ''}
      </div></div>
      <div class="card" style="padding:6px 16px"><div class="caps muted" style="margin:8px 0 2px">Sesiones</div>${tg('reserva', 'Alguien reserva')}${tg('cambio', 'Alguien cambia su turno')}${tg('comprobante', 'Suben un comprobante')}${tg('recordatorios', 'Recordatorios para mandar a pacientes')}</div>
      <div class="card" style="padding:6px 16px"><div class="caps muted" style="margin:8px 0 2px">Mi vida</div>${tg('vida', 'Recordatorios de mis eventos', 'Cada evento tiene su aviso (a la hora, 15 min, 30 min, 1 h o 1 día).')}${tg('pendientes', `Para hacer pendientes · ${esc(S.ajustes.pendientes_hora)}`)}</div>
      <div class="card" style="padding:6px 16px">${tg('resumen', `<b>Resumen del día · ${esc(S.ajustes.resumen_hora)}</b>`, 'Tus sesiones y tus cosas, en un solo aviso.')}
        <div class="fila2" style="margin:4px 0 10px"><label class="inp" style="margin:0"><small>Resumen</small><input type="time" id="hora-resumen" value="${esc(S.ajustes.resumen_hora)}"></label><label class="inp" style="margin:0"><small>Pendientes</small><input type="time" id="hora-pend" value="${esc(S.ajustes.pendientes_hora)}"></label></div>
        <button class="cta chico white" style="margin-bottom:10px" data-acc="guardar-horas-aviso">Guardar horarios</button></div>
      <p class="xs muted" style="margin:0 6px">Todos los avisos te llegan solo a vos.</p>
    </div>${navBar('ajustes')}`;
};

V['ajustes/recordatorio'] = () => {
  const a = S.ajustes, hs = a.recordatorio_horas || [];
  const pos = { ...L.IMG_RECORDATORIO, ...(a.recordatorio_img || {}) };
  const op = (h, t) => `<button class="opt ${hs.includes(h) ? 'on' : ''}" data-acc="rec-hora" data-h="${h}">${t}</button>`;
  const otras = hs.filter((h) => ![48, 24, 8, 2].includes(h));
  const rango = (k, t, min, max, paso) => `<label class="sm" style="display:block;margin:8px 0 2px">${t}<input class="rango" type="range" data-pos="${k}" min="${min}" max="${max}" step="${paso}" value="${pos[k]}"></label>`;
  return `${hero({ clase: 'mix', arriba: back('#ajustes', 'Ajustes'), titulo: 'Recordatorio a pacientes', personaje: 'tristeza', tam: 92, estilo: 'padding-bottom:52px' })}
    <div class="body">
      <div class="card">
        <div class="caps muted" style="margin-bottom:8px">¿Cuándo te aviso para mandarlo?</div>
        <div class="opts">${op(48, '2 días antes')}${op(24, '1 día antes')}${op(8, '8 h antes')}${op(2, '2 h antes')}${otras.map((h) => op(h, `${h} h antes`)).join('')}</div>
        <div style="display:flex;gap:8px;align-items:center"><label class="inp" style="margin:0;flex:1"><small>Otra (horas antes)</small><input id="rec-otra" type="number" min="1" max="168" inputmode="numeric"></label><button class="cta chico white" style="width:auto" data-acc="rec-otra">Sumar</button></div>
        <p class="xs muted" style="margin:10px 0 0">Te llega un aviso “Recordale a Martina: mañana 18:00”. Lo tocás y queda listo para mandar por WhatsApp.</p>
      </div>
      <div class="card">
        <div class="caps muted" style="margin-bottom:8px">Mensaje</div>
        <textarea id="rec-texto" class="inp" style="width:100%;min-height:150px;border:0;font-size:15px">${esc(a.recordatorio_texto || L.PLANTILLA_RECORDATORIO)}</textarea>
        <div class="opts">${['nombre', 'dia', 'hora', 'modalidad', 'link_videollamada'].map((v) => `<button class="opt" data-acc="rec-var" data-v="${v}">{${v}}</button>`).join('')}</div>
        <div class="card flat sm" id="rec-prev" style="white-space:pre-wrap;margin:0"></div>
        <button class="cta chico" style="margin-top:12px" data-acc="guardar-rec-texto">Guardar mensaje</button>
      </div>
      <div class="card">
        <div class="caps muted" style="margin-bottom:8px">Imagen</div>
        <canvas id="rec-canvas" class="preview-img" style="aspect-ratio:1122/1402"></canvas>
        ${rango('dia_y', 'Altura de la línea DÍA', 0.05, 0.95, 0.001)}${rango('hora_y', 'Altura de la línea HORA', 0.05, 0.95, 0.001)}${rango('tam', 'Tamaño de la letra', 0.02, 0.08, 0.001)}
        <div class="fila2" style="margin-top:12px"><label class="cta white chico" style="position:relative">${ico('image')}Cambiar plantilla<input type="file" id="rec-plantilla" accept="image/jpeg,image/png,image/webp" style="position:absolute;opacity:0;width:1px;height:1px"></label><button class="cta white chico" data-acc="rec-img-original">Volver a la original</button></div>
        <button class="cta chico" style="margin-top:10px" data-acc="guardar-rec-img">Guardar imagen</button>
      </div>
      <div class="card flat xs muted">Hoy se manda con un toque desde tu celu (gratis). Si más adelante querés que salga solo, se puede conectar WhatsApp Business (es pago por mensaje).</div>
    </div>${navBar('ajustes')}`;
};

// ---------------------------------------------------------------- hojas (formularios que suben desde abajo)
function abrirHoja(html, alMontar) {
  $capa.innerHTML = `<div class="capa" data-acc="cerrar-fondo"><div class="hoja" role="dialog" aria-modal="true"><div class="asa"></div>${html}</div></div>`;
  document.body.style.overflow = 'hidden';
  if (alMontar) alMontar($capa.querySelector('.hoja'));
}
function cerrarHoja() { $capa.innerHTML = ''; document.body.style.overflow = ''; }

function opcionesHorario(d, modId, excluirTurno, seleccion) {
  const ls = libresDelDia(d, excluirTurno, modId);
  return ls.length ? `<div class="slots" style="grid-template-columns:repeat(4,1fr)">${ls.map((s) => `<button class="slot ${seleccion === s.hora ? 'on' : ''}" style="font-size:15px;padding:10px 0" data-acc="hoja-hora" data-h="${s.hora}">${s.hora}</button>`).join('')}</div>` : '<p class="sm muted" style="margin:4px 0">Sin libres en la grilla ese día. Poné otra hora abajo.</p>';
}

function hojaTurno({ turno = null, paciente = null, ini = null, modalidad = null, dia = null } = {}) {
  const mover = !!turno;
  const st = { mod: turno ? turno.modalidad : modalidad || (S.modalidades.find((m) => m.activa) || S.modalidades[0]).id, dia: ini ? L.diaDe(ini) : dia || (turno ? L.diaDe(turno.inicio) : hoy()), hora: ini ? L.horaDe(ini) : null, pac: paciente || (turno ? turno.paciente_id : null), sena: 'pendiente', nuevo: false };
  const dibujar = (h) => {
    const p = st.pac ? pac(st.pac) : null;
    h.innerHTML = `<div class="asa"></div><h2>${mover ? (turno.estado === 'cancelado' ? 'Reactivar turno' : 'Mover turno') : 'Cargar turno'}</h2>
      ${mover ? `<p class="sm muted" style="margin:-6px 0 12px">${esc(pac(turno.paciente_id).nombre)} · ahora ${esc(L.fechaCorta(L.diaDe(turno.inicio)))} ${L.horaDe(turno.inicio)}</p>` : p ? `<div class="li" style="padding:0 0 10px">${avatar(p)}<span class="g"><b>${esc(p.nombre)}</b></span><button class="pillbtn" data-acc="hoja-cambiar-pac">Cambiar</button></div>`
        : st.nuevo ? `<div class="fila2"><label class="inp"><small>Nombre y apellido</small><input id="np-nombre" maxlength="80"></label><label class="inp"><small>WhatsApp</small><input id="np-tel" type="tel" maxlength="30"></label></div>`
        : `<label class="inp"><small>Paciente</small><input id="buscar-pac" placeholder="Escribí para buscar" autocomplete="off"></label><div id="lista-pac" class="card flat" style="padding:2px 14px;max-height:180px;overflow-y:auto"></div><button class="pillbtn" style="margin:0 0 12px" data-acc="hoja-nuevo-pac">${ico('plus')}Paciente nuevo</button>`}
      <div class="seg">${S.modalidades.map((m) => `<button data-acc="hoja-mod" data-id="${m.id}" class="${st.mod === m.id ? 'on' : ''}">${modTxt(m.id)}</button>`).join('')}</div>
      <label class="inp"><small>Día</small><input id="hoja-dia" type="date" value="${st.dia}"></label>
      <div class="caps muted" style="margin:4px 4px 8px">Horario</div>
      ${opcionesHorario(st.dia, st.mod, turno ? turno.id : null, st.hora)}
      <label class="inp" style="margin-top:10px"><small>U otra hora</small><input id="hoja-hora" type="time" value="${st.hora || ''}"></label>
      ${!mover ? `<div class="caps muted" style="margin:4px 4px 8px">Seña</div><div class="seg">${[['pendiente', 'Pendiente'], ['confirmada', 'Ya la pagó']].map(([k, t]) => `<button data-acc="hoja-sena" data-v="${k}" class="${st.sena === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
      <div id="hoja-err"></div>
      <button class="cta" data-acc="hoja-guardar-turno">${mover ? 'Guardar' : 'Cargar turno'}</button>
      <button class="cta white" style="margin-top:10px" data-acc="cerrar">Cancelar</button>`;
    const bp = h.querySelector('#buscar-pac');
    if (bp) {
      const lista = () => {
        const q = bp.value.toLowerCase();
        h.querySelector('#lista-pac').innerHTML = S.pacientes.filter((x) => !q || x.nombre.toLowerCase().includes(q)).slice(0, 30).map((x) => `<button class="li sm" data-acc="hoja-pac" data-id="${x.id}">${avatar(x)}<span class="g">${esc(x.nombre)}</span></button>`).join('') || '<p class="sm muted">Nadie con ese nombre.</p>';
      };
      bp.addEventListener('input', lista); lista();
    }
    h.querySelector('#hoja-dia').addEventListener('change', (e) => { st.dia = e.target.value || st.dia; st.hora = null; dibujar(h); });
    h.querySelector('#hoja-hora').addEventListener('change', (e) => { st.hora = e.target.value || null; });
  };
  ui.hoja = {
    st,
    redibujar: () => dibujar($capa.querySelector('.hoja')),
    async guardar() {
      const errEl = $capa.querySelector('#hoja-err');
      const hora = $capa.querySelector('#hoja-hora').value || st.hora;
      if (!hora) { errEl.innerHTML = '<div class="err">Elegí un horario.</div>'; return; }
      const inicio = L.msDe(st.dia, hora);
      try {
        if (mover) {
          await P.moverTurno(turno.id, inicio, st.mod);
          cerrarHoja(); await recargar();
          const p = pac(turno.paciente_id);
          return avisarPaciente(p, `Hola ${L.primerNombre(p.nombre)}! Te cambié el turno: ahora es el ${L.fechaLarga(st.dia)} a las ${hora} (${st.mod}). Cualquier cosa avisame.`);
        }
        let pid = st.pac;
        if (!pid && st.nuevo) {
          const n = $capa.querySelector('#np-nombre').value.trim(), tel = $capa.querySelector('#np-tel').value.trim();
          const np = await P.guardarPaciente({ nombre: n, telefono: tel });
          pid = np.id;
        }
        if (!pid) { errEl.innerHTML = '<div class="err">Elegí a quién es el turno.</div>'; return; }
        const t = await P.crearTurno({ paciente_id: pid, servicio_id: (S.servicios.find((s) => s.activo) || {}).id, modalidad: st.mod, inicio, sena: st.sena });
        cerrarHoja(); await recargar();
        const p = pac(pid);
        avisarPaciente(p, `Hola ${L.primerNombre(p.nombre)}! Te agendé la sesión del ${L.fechaLarga(st.dia)} a las ${hora} (${st.mod}). Acá podés ver tu turno: ${linkTurno(t)}`, 'Turno cargado');
      } catch (e) { errEl.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    },
  };
  abrirHoja('', dibujar);
}

function avisarPaciente(p, texto, titulo = 'Listo') {
  abrirHoja(`<h2>${esc(titulo)}</h2><p class="sm">¿Le avisás a ${esc(L.primerNombre(p.nombre))} por WhatsApp?</p>
    <div class="card flat sm" style="white-space:pre-wrap">${esc(texto)}</div>
    <a class="cta wa" href="${L.linkWa(p.telefono, texto)}" target="_blank" rel="noopener" data-acc="cerrar">${ico('chat')}Mandar por WhatsApp</a>
    <button class="cta white" style="margin-top:10px" data-acc="cerrar">Ahora no</button>`);
}

function hojaPaciente(p = {}) {
  abrirHoja(`<h2>${p.id ? 'Editar paciente' : 'Paciente nuevo'}</h2><div id="form-pac">
    <label class="inp"><small>Nombre y apellido</small><input data-k="nombre" value="${esc(p.nombre || '')}" maxlength="80"></label>
    <div class="fila2"><label class="inp"><small>WhatsApp</small><input data-k="telefono" type="tel" value="${esc(p.telefono || '')}" maxlength="30"></label><label class="inp"><small>Nacimiento</small><input data-k="nacimiento" type="date" value="${esc(p.nacimiento || '')}"></label></div>
    <label class="inp"><small>Mail</small><input data-k="email" type="email" value="${esc(p.email || '')}" maxlength="120"></label>
    <div class="fila2"><label class="inp"><small>Adulto responsable</small><input data-k="responsable_nombre" value="${esc(p.responsable_nombre || '')}" maxlength="80"></label><label class="inp"><small>Su teléfono</small><input data-k="responsable_telefono" type="tel" value="${esc(p.responsable_telefono || '')}" maxlength="30"></label></div>
    <label class="inp"><small>Notas privadas</small><textarea data-k="notas">${esc(p.notas || '')}</textarea></label>
    <div id="hoja-err"></div>
    <button class="cta" data-acc="guardar-paciente" data-id="${p.id || ''}">Guardar</button>
    ${p.id ? `<button class="cta rojo" style="margin-top:10px" data-acc="borrar-paciente" data-id="${p.id}">${ico('trash')}Borrar paciente y sus turnos</button>` : ''}
    <button class="cta white" style="margin-top:10px" data-acc="cerrar">Cancelar</button></div>`);
}

function hojaEvento(e = {}) {
  const st = { tipo: e.tipo || 'evento', color: e.color || '#8A4BF2', repetir: e.repetir || 'no', aviso: e.id ? e.aviso_min ?? null : (e.tipo === 'tarea' ? null : 30), bloquea: !!e.bloquea };
  const dibujar = (h) => {
    h.innerHTML = `<div class="asa"></div><div class="seg">${[['evento', 'Evento'], ['tarea', 'Para hacer']].map(([k, t]) => `<button data-acc="ev-tipo" data-v="${k}" class="${st.tipo === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="form-ev">
      <label class="inp"><small>Título</small><input data-k="titulo" value="${esc(e.titulo || '')}" maxlength="120"></label>
      <label class="inp"><small>Día${st.tipo === 'tarea' ? ' · opcional' : ''}</small><input data-k="fecha" type="date" value="${esc(e.fecha || (st.tipo === 'evento' ? ui.diaVida || hoy() : ''))}"></label>
      <div class="fila2"><label class="inp"><small>Desde${st.tipo === 'tarea' ? ' · opcional' : ''}</small><input data-k="hora_inicio" type="time" value="${esc(e.hora_inicio || '')}"></label>${st.tipo === 'evento' ? `<label class="inp"><small>Hasta</small><input data-k="hora_fin" type="time" value="${esc(e.hora_fin || '')}"></label>` : '<span></span>'}</div>
      </div>
      ${st.tipo === 'evento' ? `<div class="caps muted" style="margin:6px 4px 8px">Color</div><div style="display:flex;gap:10px;margin:0 4px 14px;flex-wrap:wrap">${COLORES_VIDA.map((c) => `<button class="cdot ${st.color === c ? 'on' : ''}" style="background:${c};color:${c}" data-acc="ev-color" data-v="${c}" aria-label="Color"></button>`).join('')}</div>
        <div class="caps muted" style="margin:0 4px 8px">Repetir</div><div class="seg">${[['no', 'No'], ['semanal', 'Cada semana']].map(([k, t]) => `<button data-acc="ev-repetir" data-v="${k}" class="${st.repetir === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
      <div class="caps muted" style="margin:0 4px 8px">Avisarme</div>
      <div class="opts">${AVISOS_VIDA.map(([v, t]) => `<button class="opt ${st.aviso === v ? 'on' : ''}" data-acc="ev-aviso" data-v="${v == null ? '' : v}">${t}${v != null && v > 0 ? ' antes' : ''}</button>`).join('')}</div>
      ${st.tipo === 'evento' ? `<div class="li sm" style="cursor:default"><span class="g"><b>Bloquear este horario para pacientes</b><br><span class="xs muted">Si lo activás, ese rato no aparece en la página de reservas.</span></span><button class="toggle ${st.bloquea ? 'on' : ''}" data-acc="ev-bloquea" aria-label="Bloquear"></button></div>` : ''}
      <div class="xs muted" style="margin:2px 4px 0">${ico('lock', '', 'width:13px;height:13px;vertical-align:-2px')} Privado: tus pacientes nunca ven tus eventos.</div>
      <div id="hoja-err"></div>
      <button class="cta" data-acc="guardar-evento">Guardar</button>
      ${e.id ? `<button class="cta rojo" style="margin-top:10px" data-acc="borrar-evento" data-id="${e.id}">${ico('trash')}Borrar</button>` : ''}
      <button class="cta white" style="margin-top:10px" data-acc="cerrar">Cancelar</button>`;
  };
  ui.hoja = {
    st, redibujar: () => { const h = $capa.querySelector('.hoja'); Object.assign(e, leerForm(h.querySelector('#form-ev'))); dibujar(h); },
    async guardar() {
      const h = $capa.querySelector('.hoja');
      const f = leerForm(h.querySelector('#form-ev'));
      const ev = { ...(e.id ? { id: e.id } : {}), tipo: st.tipo, titulo: f.titulo, fecha: f.fecha || null, hora_inicio: f.hora_inicio || null, hora_fin: st.tipo === 'evento' ? f.hora_fin || null : null, repetir: st.tipo === 'evento' ? st.repetir : 'no', aviso_min: st.aviso, bloquea: st.tipo === 'evento' && st.bloquea, color: st.color };
      if (st.tipo === 'evento' && !ev.fecha) { h.querySelector('#hoja-err').innerHTML = '<div class="err">Elegí el día.</div>'; return; }
      if (ev.aviso_min != null && (!ev.fecha || !ev.hora_inicio)) { h.querySelector('#hoja-err').innerHTML = '<div class="err">Para el aviso, poné día y hora.</div>'; return; }
      try { await P.guardarEvento(ev); cerrarHoja(); await recargar(); toast('Guardado'); }
      catch (er) { h.querySelector('#hoja-err').innerHTML = `<div class="err">${esc(er.message)}</div>`; }
    },
  };
  abrirHoja('', dibujar);
}

function hojaDiaHorario(n) {
  const m = mod(ui.modHorario);
  const r = ((m.horario || {})[String(n)] || []).map((x) => [...x]);
  const dibujar = (h) => {
    h.innerHTML = `<div class="asa"></div><h2>${modTxt(m.id)} · ${L.DIAS_LARGOS[n]}</h2>
      ${r.map(([a, b], i) => `<div style="display:flex;gap:8px;align-items:center"><label class="inp" style="flex:1"><small>Desde</small><input type="time" data-r="${i}" data-p="0" value="${a}"></label><label class="inp" style="flex:1"><small>Hasta</small><input type="time" data-r="${i}" data-p="1" value="${b}"></label><button class="circ" style="width:38px;height:38px;margin-bottom:10px" data-acc="tramo-quitar" data-i="${i}" aria-label="Quitar">${ico('trash')}</button></div>`).join('') || '<p class="sm muted">Este día no atendés.</p>'}
      ${r.length < 4 ? `<button class="pillbtn" data-acc="tramo-sumar">${ico('plus')}Sumar horario</button>` : ''}
      <div id="hoja-err"></div>
      <button class="cta" data-acc="guardar-dia">Guardar</button><button class="cta white" style="margin-top:10px" data-acc="cerrar">Cancelar</button>`;
    h.querySelectorAll('input[data-r]').forEach((el) => el.addEventListener('change', () => { r[Number(el.dataset.r)][Number(el.dataset.p)] = el.value; }));
  };
  ui.hoja = {
    r, redibujar: () => dibujar($capa.querySelector('.hoja')),
    async guardar() {
      const ok = r.filter(([a, b]) => L.minutos(a) != null && L.minutos(b) != null);
      if (ok.some(([a, b]) => L.minutos(b) <= L.minutos(a))) { $capa.querySelector('#hoja-err').innerHTML = '<div class="err">El “hasta” tiene que ser después del “desde”.</div>'; return; }
      const horario = { ...(m.horario || {}) };
      if (ok.length) horario[String(n)] = ok.sort((x, y) => L.minutos(x[0]) - L.minutos(y[0])); else delete horario[String(n)];
      await P.guardarModalidad({ id: m.id, horario }); cerrarHoja(); await recargar(); toast('Horario guardado');
    },
  };
  abrirHoja('', dibujar);
}

// ---------------------------------------------------------------- recordatorio: imagen y compartir
async function datosImagen(t) {
  const a = S.ajustes;
  let plantilla = PLANTILLA_APP;
  if (a.recordatorio_imagen) { try { plantilla = (await P.urlPlantilla(a.recordatorio_imagen)) || PLANTILLA_APP; } catch { plantilla = PLANTILLA_APP; } }
  return { plantilla, dia: L.textoDiaImagen(t.inicio), hora: L.textoHoraImagen(t.inicio), pos: a.recordatorio_img };
}
async function compartirRecordatorio(t, btn) {
  const p = pac(t.paciente_id);
  const texto = (document.getElementById('txt-rec') || {}).value || L.textoRecordatorio(t, p, S.ajustes);
  const rec = S.recordatorios.find((r) => r.turno_id === t.id && r.para === t.inicio && r.estado === 'pendiente');
  if (btn) btn.disabled = true;
  try {
    const file = await imagenRecordatorio(await datosImagen(t));
    await copiar(texto);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: texto });
        if (rec) await P.marcarRecordatorio(rec.id, 'enviado');
        await recargar();
        toast('Listo. Si WhatsApp no pegó el texto, mantené apretado y Pegar.');
      } catch (e) { if (e && e.name !== 'AbortError') throw e; }
    } else {
      // Sin compartir archivos (compu): abre el chat con el texto y baja la imagen para adjuntarla.
      bajar(file);
      window.open(L.linkWa(p.telefono, texto), '_blank', 'noopener');
      toast('Se bajó la imagen: adjuntala en el chat.');
      if (rec) { await P.marcarRecordatorio(rec.id, 'enviado'); await recargar(); }
    }
  } catch (e) { toast(e.message || 'No se pudo compartir'); }
  finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
}
function bajar(file) {
  const u = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: u, download: file.name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

// Vista previa del ajuste de imagen (con un turno de ejemplo).
let posPrev = null, plantillaPrev = undefined;
async function dibujarPrevAjustes() {
  const c = document.getElementById('rec-canvas');
  if (!c) return;
  const ejemplo = L.msDe(L.sumarDias(hoy(), 1), '18:00');
  let plantilla = PLANTILLA_APP;
  const ruta = plantillaPrev !== undefined ? plantillaPrev : S.ajustes.recordatorio_imagen;
  if (ruta) { try { plantilla = (await P.urlPlantilla(ruta)) || PLANTILLA_APP; } catch { /* original */ } }
  try { await dibujarRecordatorio({ plantilla, dia: L.textoDiaImagen(ejemplo), hora: L.textoHoraImagen(ejemplo), pos: posPrev || S.ajustes.recordatorio_img }, c); } catch { /* */ }
}
function prevTextoRec() {
  const el = document.getElementById('rec-prev'), ta = document.getElementById('rec-texto');
  if (!el || !ta) return;
  const t = { inicio: L.msDe(L.sumarDias(hoy(), 1), '18:00'), modalidad: 'virtual' };
  el.textContent = L.llenarPlantilla(ta.value, L.varsTurno(t, { nombre: 'Martina Gómez' }, S.ajustes));
}

// ---------------------------------------------------------------- avisos push (este celu)
const b64uBytes = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(t + '='.repeat((4 - (t.length % 4)) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function activarPush() {
  const est = document.getElementById('estado-push');
  try {
    if (D.modo === 'demo' || !CFG.vapidPublic) { if (est) est.textContent = 'En la demo no se activan avisos reales. Se activan cuando la app esté publicada con sus claves.'; return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { if (est) est.textContent = 'No diste permiso. En iPhone: Ajustes → Notificaciones → Mi agenda.'; return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(CFG.vapidPublic) });
    await P.suscribirPush(sub);
    if (est) est.textContent = 'Listo: este celu recibe tus avisos.';
    toast('Avisos activados');
  } catch (e) { if (est) est.textContent = 'No se pudo activar: ' + (e.message || e); }
}

// ---------------------------------------------------------------- acciones
const A = {};
A.entrar = async (b) => {
  const f = leerForm(document.getElementById('form-login'));
  b.disabled = true;
  try { await P.entrar(f.email, f.clave); await recargar(); if (!location.hash) location.hash = '#hoy'; else render(); }
  catch (e) { document.getElementById('login-err').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  finally { b.disabled = false; }
};
A.salir = async () => { await P.salir(); S = null; location.hash = ''; render(); };
A['reiniciar-demo'] = async () => { D.demo.reiniciar(); await recargar(); toast('Demo reiniciada'); };
A.mas = () => (rutaActual()[0] === 'vida' ? hojaEvento({ fecha: ui.diaVida }) : hojaTurno({ dia: ui.diaHoy }));
A['nuevo-turno'] = (b) => hojaTurno({ ini: b.dataset.ini ? Number(b.dataset.ini) : null, modalidad: b.dataset.mod || null, paciente: b.dataset.pac ? Number(b.dataset.pac) : null, dia: b.dataset.dia || null });
A['hoja-mod'] = (b) => { ui.hoja.st.mod = b.dataset.id; ui.hoja.st.hora = null; ui.hoja.redibujar(); };
A['hoja-hora'] = (b) => { ui.hoja.st.hora = b.dataset.h; ui.hoja.redibujar(); };
A['hoja-sena'] = (b) => { ui.hoja.st.sena = b.dataset.v; ui.hoja.redibujar(); };
A['hoja-pac'] = (b) => { ui.hoja.st.pac = Number(b.dataset.id); ui.hoja.redibujar(); };
A['hoja-cambiar-pac'] = () => { ui.hoja.st.pac = null; ui.hoja.redibujar(); };
A['hoja-nuevo-pac'] = () => { ui.hoja.st.nuevo = true; ui.hoja.redibujar(); };
A['hoja-guardar-turno'] = () => ui.hoja.guardar();
A.cerrar = () => cerrarHoja();
A['cerrar-fondo'] = (b, ev) => { if (ev.target === b) cerrarHoja(); };
A.mover = (b) => hojaTurno({ turno: turnoDe(Number(b.dataset.id)) });
A.cancelar = (b) => {
  const t = turnoDe(Number(b.dataset.id)), p = pac(t.paciente_id);
  abrirHoja(`<h2>Cancelar turno</h2><p class="sm">${esc(p.nombre)} · ${esc(L.fechaLarga(L.diaDe(t.inicio)))} ${L.horaDe(t.inicio)}</p>
    <label class="inp"><small>Motivo (solo para vos) · opcional</small><input id="motivo-cancel" maxlength="200"></label>
    <button class="cta rojo" data-acc="confirmar-cancelar" data-id="${t.id}">${ico('ban')}Cancelar el turno</button><button class="cta white" style="margin-top:10px" data-acc="cerrar">Volver</button>`);
};
A['confirmar-cancelar'] = async (b) => {
  const t = turnoDe(Number(b.dataset.id)), p = pac(t.paciente_id);
  await P.cancelarTurno(t.id, document.getElementById('motivo-cancel').value.trim());
  cerrarHoja(); await recargar();
  avisarPaciente(p, `Hola ${L.primerNombre(p.nombre)}! Te escribo por la sesión del ${L.fechaLarga(L.diaDe(t.inicio))} a las ${L.horaDe(t.inicio)}: quedó cancelada. Cualquier cosa hablamos.`, 'Turno cancelado');
};
A['sena-ok'] = async (b) => { await P.senaTurno(Number(b.dataset.id), 'confirmada'); await recargar(); toast('Seña confirmada'); };
A['sena-pend'] = async (b) => { const t = turnoDe(Number(b.dataset.id)); await P.senaTurno(t.id, t.comprobante ? 'por_revisar' : 'pendiente'); await recargar(); };
A['ver-comprobante'] = async (b) => {
  const url = await P.urlComprobante(b.dataset.path);
  const pdf = /\.pdf($|\?)/i.test(b.dataset.path) || /^data:application\/pdf/.test(url);
  const v = document.createElement('div');
  v.className = 'visor';
  v.innerHTML = `${pdf ? `<iframe src="${esc(url)}" title="Comprobante"></iframe>` : `<img src="${esc(url)}" alt="Comprobante">`}<button class="circ" aria-label="Cerrar">${ico('x')}</button>`;
  v.addEventListener('click', () => v.remove());
  document.body.appendChild(v);
};
A['mandar-link'] = (b) => { const t = turnoDe(Number(b.dataset.id)), p = pac(t.paciente_id); window.open(L.linkWa(p.telefono, `Hola ${L.primerNombre(p.nombre)}! Acá podés ver tu turno: ${linkTurno(t)} . Si necesitás cambiarlo o cancelarlo, escribime por acá.`), '_blank', 'noopener'); };
// Mensaje lindo para mandar el link de reservas por WhatsApp (negritas con *, emojis simples).
function mensajeReservas() {
  const a = S.ajustes || {};
  const h = a.horas_cambio || 24;
  return [
    '¡Hola! 🌿',
    'Te comparto el link para reservar tu sesión:',
    `👉 ${linkReservas()}`,
    '',
    '*¿Cómo reservar?*',
    '1️⃣ Elegís si preferís la sesión *presencial* o *virtual*.',
    '2️⃣ Elegís el día y el horario que te queden cómodos.',
    '3️⃣ Completás tus datos.',
    `4️⃣ Transferís la seña${a.alias ? ` al alias *${a.alias}*` : ''} y subís el comprobante. ¡Y listo!`,
    '',
    '📌 *Tené en cuenta*',
    '• La seña no se reembolsa.',
    '• Para cambiar o cancelar el turno, escribime por acá.',
    '',
    'Cualquier duda, consultame. ¡Te espero! 💜',
    `${a.nombre_publico || 'Lic. Agustina Arrieta'}`,
  ].join('\n');
}
A['copiar-link'] = async () => toast((await copiar(linkReservas())) ? 'Link copiado' : 'No se pudo copiar');
A['compartir-link'] = async () => {
  const texto = mensajeReservas();
  if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  window.open(L.linkWa('', texto), '_blank', 'noopener');
};
A['filtro-pac'] = (b) => { ui.filtroPac = b.dataset.f; render(); };
A['nuevo-paciente'] = () => hojaPaciente();
A['editar-paciente'] = (b) => hojaPaciente(pac(Number(b.dataset.id)));
A['guardar-paciente'] = async (b) => {
  const f = leerForm(document.getElementById('form-pac'));
  try { const p = await P.guardarPaciente({ ...(b.dataset.id ? { id: Number(b.dataset.id) } : {}), ...f, nacimiento: f.nacimiento || null }); cerrarHoja(); await recargar(); if (!b.dataset.id) location.hash = `#paciente/${p.id}`; toast('Guardado'); }
  catch (e) { document.getElementById('hoja-err').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
};
A['borrar-paciente'] = async (b) => {
  if (!confirm('¿Borrar este paciente y todos sus turnos? No se puede deshacer.')) return;
  await P.borrarPaciente(Number(b.dataset.id)); cerrarHoja(); await recargar(); location.hash = '#pacientes';
};
A['guardar-notas'] = async (b) => { const p = pac(Number(b.dataset.id)); await P.guardarPaciente({ id: p.id, notas: document.getElementById('notas').value }); await recargar(); toast('Notas guardadas'); };
A['compartir-rec'] = (b) => compartirRecordatorio(turnoDe(Number(b.dataset.id)), b);
A['guardar-img'] = async (b) => { const t = turnoDe(Number(b.dataset.id)); bajar(await imagenRecordatorio(await datosImagen(t))); };
A['abrir-chat'] = (b) => { const t = turnoDe(Number(b.dataset.id)), p = pac(t.paciente_id); window.open(L.linkWa(p.telefono, document.getElementById('txt-rec').value), '_blank', 'noopener'); };
A['rec-enviado'] = async (b) => { await P.marcarRecordatorio(Number(b.dataset.id), 'enviado'); await recargar(); toast('Marcado como enviado'); };
A['vida-filtro'] = (b) => { ui.vidaFiltro = b.dataset.f; render(); };
A['nuevo-evento'] = (b) => hojaEvento({ tipo: b.dataset.tipo || 'evento', fecha: b.dataset.tipo === 'tarea' ? null : b.dataset.dia });
A['editar-evento'] = (b) => hojaEvento({ ...S.eventos.find((e) => e.id === Number(b.dataset.id)) });
A['ev-tipo'] = (b) => { ui.hoja.st.tipo = b.dataset.v; if (b.dataset.v === 'tarea') ui.hoja.st.aviso = null; ui.hoja.redibujar(); };
A['ev-color'] = (b) => { ui.hoja.st.color = b.dataset.v; ui.hoja.redibujar(); };
A['ev-repetir'] = (b) => { ui.hoja.st.repetir = b.dataset.v; ui.hoja.redibujar(); };
A['ev-aviso'] = (b) => { ui.hoja.st.aviso = b.dataset.v === '' ? null : Number(b.dataset.v); ui.hoja.redibujar(); };
A['ev-bloquea'] = () => { ui.hoja.st.bloquea = !ui.hoja.st.bloquea; ui.hoja.redibujar(); };
A['guardar-evento'] = () => ui.hoja.guardar();
A['borrar-evento'] = async (b) => { await P.borrarEvento(Number(b.dataset.id)); cerrarHoja(); await recargar(); toast('Borrado'); };
A['tarea-hecha'] = async (b) => { const e = S.eventos.find((x) => x.id === Number(b.dataset.id)); await P.guardarEvento({ id: e.id, hecho: !e.hecho }); await recargar(); };
A['guardar-ajustes'] = async (b) => {
  const f = leerForm(document.getElementById(b.dataset.form));
  try { await P.guardarAjustes(f); await recargar(); toast('Guardado'); } catch (e) { toast(e.message); }
};
A['editar-servicio'] = (b) => {
  const s = b.dataset.id ? servicio(Number(b.dataset.id)) : { nombre: '', detalle: '', precio: 0, activo: true, orden: S.servicios.length + 1 };
  abrirHoja(`<h2>${s.id ? 'Editar servicio' : 'Servicio nuevo'}</h2><div id="form-serv">
    <label class="inp"><small>Nombre</small><input data-k="nombre" value="${esc(s.nombre)}" maxlength="80"></label>
    <label class="inp"><small>Detalle</small><input data-k="detalle" value="${esc(s.detalle)}" maxlength="160"></label>
    <label class="inp"><small>Precio ($)</small><input data-k="precio" type="number" min="0" step="500" value="${s.precio}"></label>
    <div id="hoja-err"></div>
    <button class="cta" data-acc="guardar-servicio" data-id="${s.id || ''}">Guardar</button>
    ${s.id ? `<button class="cta rojo" style="margin-top:10px" data-acc="borrar-servicio" data-id="${s.id}">${ico('trash')}Quitar servicio</button>` : ''}
    <button class="cta white" style="margin-top:10px" data-acc="cerrar">Cancelar</button></div>`);
};
A['guardar-servicio'] = async (b) => {
  const f = leerForm(document.getElementById('form-serv'));
  if (f.nombre.length < 2) { document.getElementById('hoja-err').innerHTML = '<div class="err">Escribí el nombre.</div>'; return; }
  await P.guardarServicio({ ...(b.dataset.id ? { id: Number(b.dataset.id) } : { activo: true, orden: S.servicios.length + 1 }), ...f, precio: Number(f.precio) || 0 });
  cerrarHoja(); await recargar(); toast('Guardado');
};
A['borrar-servicio'] = async (b) => { try { await P.borrarServicio(Number(b.dataset.id)); cerrarHoja(); await recargar(); } catch (e) { document.getElementById('hoja-err').innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
A['mod-horario'] = (b) => { ui.modHorario = b.dataset.id; render(); };
A['mod-activa'] = async () => { const m = mod(ui.modHorario); await P.guardarModalidad({ id: m.id, activa: !m.activa }); await recargar(); };
A['guardar-mod'] = async () => {
  const f = leerForm(document.getElementById('form-mod'));
  if (!(f.duracion >= 15 && f.duracion <= 240) || !(f.descanso >= 0 && f.descanso <= 120)) return toast('Revisá duración (15 a 240) y descanso (0 a 120).');
  await P.guardarModalidad({ id: ui.modHorario, ...f }); await recargar(); toast('Guardado');
};
A['editar-dia'] = (b) => hojaDiaHorario(Number(b.dataset.d));
A['tramo-sumar'] = () => { ui.hoja.r.push(['09:00', '13:00']); ui.hoja.redibujar(); };
A['tramo-quitar'] = (b) => { ui.hoja.r.splice(Number(b.dataset.i), 1); ui.hoja.redibujar(); };
A['guardar-dia'] = () => ui.hoja.guardar();
A['nuevo-bloqueo'] = () => abrirHoja(`<h2>Bloquear días</h2><div id="form-bl">
  <div class="fila2"><label class="inp"><small>Desde</small><input data-k="desde" type="date" value="${hoy()}"></label><label class="inp"><small>Hasta</small><input data-k="hasta" type="date" value="${hoy()}"></label></div>
  <label class="inp"><small>Motivo (no lo ven los pacientes)</small><input data-k="motivo" maxlength="80" placeholder="Vacaciones, feriado…"></label>
  <label class="inp"><small>Modalidad</small><select data-k="modalidad"><option value="">Las dos</option><option value="presencial">Solo presencial</option><option value="virtual">Solo virtual</option></select></label>
  <div id="hoja-err"></div><button class="cta" data-acc="guardar-bloqueo">Bloquear</button><button class="cta white" style="margin-top:10px" data-acc="cerrar">Cancelar</button></div>`);
A['guardar-bloqueo'] = async () => {
  const f = leerForm(document.getElementById('form-bl'));
  if (!f.desde || (f.hasta && f.hasta < f.desde)) { document.getElementById('hoja-err').innerHTML = '<div class="err">Revisá las fechas.</div>'; return; }
  const choques = activos().filter((t) => { const d = L.diaDe(t.inicio); return d >= f.desde && d <= (f.hasta || f.desde) && (!f.modalidad || f.modalidad === t.modalidad); }).length;
  await P.guardarBloqueo({ ...f, modalidad: f.modalidad || null }); cerrarHoja(); await recargar();
  toast(choques ? `Bloqueado. Ojo: ya hay ${choques} ${choques === 1 ? 'turno' : 'turnos'} esos días.` : 'Días bloqueados', 4000);
};
A['borrar-bloqueo'] = async (b) => { await P.borrarBloqueo(Number(b.dataset.id)); await recargar(); };
A.aviso = async (b) => { const av = { ...(S.ajustes.avisos || {}) }; av[b.dataset.k] = av[b.dataset.k] === false; await P.guardarAjustes({ avisos: av }); await recargar(); };
A['guardar-horas-aviso'] = async () => { await P.guardarAjustes({ resumen_hora: document.getElementById('hora-resumen').value || '08:00', pendientes_hora: document.getElementById('hora-pend').value || '20:00' }); await recargar(); toast('Guardado'); };
A['activar-push'] = () => activarPush();
A['probar-push'] = async () => { try { const r = await P.probarPush(); await recargar(); toast(r.demo ? 'Demo: el aviso quedó en la campanita.' : r.ok ? 'Aviso enviado' : 'No hay celus con avisos activados'); } catch (e) { toast(e.message); } };
A['rec-hora'] = async (b) => { const h = Number(b.dataset.h); let hs = [...(S.ajustes.recordatorio_horas || [])]; hs = hs.includes(h) ? hs.filter((x) => x !== h) : [...hs, h].slice(-4); await P.guardarAjustes({ recordatorio_horas: hs.sort((x, y) => y - x) }); await recargar(); };
A['rec-otra'] = async () => { const h = Number(document.getElementById('rec-otra').value); if (!(h >= 1 && h <= 168)) return toast('Entre 1 y 168 horas.'); const hs = [...new Set([...(S.ajustes.recordatorio_horas || []), h])].slice(-4); await P.guardarAjustes({ recordatorio_horas: hs.sort((x, y) => y - x) }); await recargar(); };
A['rec-var'] = (b) => { const ta = document.getElementById('rec-texto'); const v = `{${b.dataset.v}}`; const i = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, i) + v + ta.value.slice(ta.selectionEnd ?? i); ta.focus(); prevTextoRec(); };
A['guardar-rec-texto'] = async () => { await P.guardarAjustes({ recordatorio_texto: document.getElementById('rec-texto').value }); await recargar(); toast('Mensaje guardado'); };
A['rec-img-original'] = () => { plantillaPrev = null; posPrev = { ...L.IMG_RECORDATORIO }; document.querySelectorAll('[data-pos]').forEach((el) => { el.value = posPrev[el.dataset.pos]; }); dibujarPrevAjustes(); };
A['guardar-rec-img'] = async () => { const p = { ...(S.ajustes.recordatorio_img || {}), ...(posPrev || {}) }; const cambio = { recordatorio_img: p }; if (plantillaPrev !== undefined) cambio.recordatorio_imagen = plantillaPrev; await P.guardarAjustes(cambio); plantillaPrev = undefined; posPrev = null; await recargar(); toast('Imagen guardada'); };

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-acc]');
  if (!b || !A[b.dataset.acc]) return;
  if (b.dataset.acc !== 'cerrar-fondo' && b.tagName !== 'A') ev.preventDefault();
  try { await A[b.dataset.acc](b, ev); } catch (e) { toast(e.message || 'Algo salió mal'); }
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'buscar') { ui.buscar = ev.target.value; const pos = ev.target.selectionStart; render(); const el = document.getElementById('buscar'); el.focus(); el.setSelectionRange(pos, pos); }
  if (ev.target.id === 'rec-texto') prevTextoRec();
  if (ev.target.dataset && ev.target.dataset.pos) { posPrev = { ...(posPrev || S.ajustes.recordatorio_img || L.IMG_RECORDATORIO), [ev.target.dataset.pos]: Number(ev.target.value) }; dibujarPrevAjustes(); }
});
document.addEventListener('change', async (ev) => {
  if (ev.target.id === 'rec-plantilla' && ev.target.files[0]) {
    try { const path = await P.subirPlantilla(ev.target.files[0]); plantillaPrev = path; await recargar(); dibujarPrevAjustes(); toast('Plantilla nueva cargada'); } catch (e) { toast(e.message); }
  }
});

// ---------------------------------------------------------------- ruteo
function rutaActual() { return (location.hash.replace(/^#/, '') || 'hoy').split('/'); }
function render() {
  document.querySelector('.demo-bar')?.remove();
  if (!S) { $app.classList.remove('con-nav'); $app.innerHTML = V.login(); ponerDemoBar(); return; }
  const [r, a, b] = rutaActual();
  let html;
  if (r === 'hoy') { ui.diaHoy = hoy(); html = V.hoy(); }
  else if (r === 'dia') { ui.diaHoy = a || hoy(); html = V.hoy(ui.diaHoy); }
  else if (r === 'semana') html = V.semana(a ? L.lunesDe(a) : undefined);
  else if (r === 'pacientes') html = V.pacientes();
  else if (r === 'paciente') html = V.paciente(a);
  else if (r === 'turno') html = V.turno(a);
  else if (r === 'recordar') html = V.recordar(a);
  else if (r === 'vida') { ui.diaVida = a || hoy(); html = V.vida(ui.diaVida); }
  else if (r === 'notifs') html = V.notifs();
  else if (r === 'ajustes') html = (V[a ? `ajustes/${a}` : 'ajustes'] || V.ajustes)();
  else html = V.hoy();
  const conNav = html.includes('class="nav"');
  if (conNav) html = `<header class="topbar"><img src="logo/logo.svg" alt="RESET" class="topbar-logo"><a href="#ajustes" class="topbar-gear${r === 'ajustes' ? ' on' : ''}" aria-label="Ajustes">${ico('gear')}</a></header>` + html;
  $app.innerHTML = html;
  $app.classList.toggle('con-nav', conNav);
  ponerDemoBar();
  if (r === 'recordar') pintarRecordatorio(a);
  if (r === 'ajustes' && a === 'recordatorio') { dibujarPrevAjustes(); prevTextoRec(); }
  if (r === 'notifs' && noLeidas()) P.leerNotificaciones().then(() => S.notificaciones.forEach((n) => { n.leida = true; }));
  void b;
}
async function pintarRecordatorio(id) {
  const t = turnoDe(Number(id)), c = document.getElementById('img-rec');
  if (!t || !c) return;
  try { await dibujarRecordatorio(await datosImagen(t), c); } catch { /* */ }
}
function ponerDemoBar() {
  if (D && D.modo === 'demo') {
    const b = document.createElement('div');
    b.className = 'demo-bar';
    b.innerHTML = 'DEMO · datos inventados <a href="reservar.html">Página de pacientes</a>';
    $app.prepend(b);
  }
}
async function recargar() {
  if (!(await P.sesion())) { S = null; render(); return; }
  S = await P.cargar();
  render();
}

window.addEventListener('hashchange', () => { cerrarHoja(); render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S) recargar().catch(() => {}); });
setInterval(() => { if (S && document.visibilityState === 'visible' && !$capa.innerHTML) recargar().catch(() => {}); }, 60000);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.ir) location.hash = e.data.ir; });
}

async function iniciar() {
  ponerSprite();
  $app.innerHTML = `<div class="body center" style="padding-top:120px">${emo('alegria', 120)}<p class="muted">Cargando…</p></div>`;
  try {
    D = await crearCapaDatos(CFG);
    P = D.panel;
    P.onSesion(() => { S = null; render(); });
    if (RECUPERO && P.cambiarClave && await P.sesion()) { history.replaceState(null, '', location.pathname); pantallaClave(); return; }
    await recargar();
  } catch (e) {
    $app.innerHTML = `${hero({ clase: 'lav', ancho: true, titulo: 'Uy, algo falló', sub: esc(e.message), personaje: 'tristeza' })}<div class="body"><button class="cta" onclick="location.reload()">Probar de nuevo</button></div>`;
  }
}
function pantallaClave() {
  $app.innerHTML = `${hero({ clase: 'lav', ancho: true, titulo: 'Elegí tu contraseña', sub: 'Es la que vas a usar para entrar a Mi agenda.', personaje: 'alegria' })}
  <div class="body" id="form-clave"><label class="inp"><small>Contraseña nueva (mínimo 8)</small><input data-k="c1" type="password" autocomplete="new-password"></label>
  <label class="inp"><small>Repetila</small><input data-k="c2" type="password" autocomplete="new-password"></label><div id="clave-err"></div><button class="cta" data-acc="guardar-clave">Guardar y entrar</button></div>`;
}
A['guardar-clave'] = async (b) => {
  const f = leerForm(document.getElementById('form-clave')); const err = document.getElementById('clave-err');
  if (!f.c1 || f.c1.length < 8) { err.innerHTML = '<div class="err">Tiene que tener al menos 8 caracteres.</div>'; return; }
  if (f.c1 !== f.c2) { err.innerHTML = '<div class="err">No coinciden.</div>'; return; }
  b.disabled = true;
  try { await P.cambiarClave(f.c1); toast('Contraseña guardada'); await recargar(); location.hash = '#hoy'; render(); }
  catch (e) { err.innerHTML = `<div class="err">${esc(e.message)}</div>`; } finally { b.disabled = false; }
};
iniciar();
