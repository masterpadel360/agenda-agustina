// Prueba en Chrome sin ventana (modo DEMO, 390 px de ancho). Sin npm: habla con Chrome por DevTools (WebSocket).
// Uso: node tests/navegador.mjs   (CHROME=ruta si no está en el lugar de siempre)
// Recorre: (1) reserva completa con comprobante, (2) cambio con más de 24 h, (3) cambio con menos de 24 h (bloqueado,
// también en la capa de datos), (4) el panel ve la reserva y confirma la seña, (5) recordatorio (imagen + compartir).
// Capturas en capturas/. Falla si hay errores de JS, desborde horizontal o estrellas.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { servir } from '../herramientas/servidor.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CAPT = path.join(raiz, 'capturas');
fs.mkdirSync(CAPT, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, fail = 0;
const errores = [];
function chk(nombre, cond, extra = '') { if (cond) { ok++; console.log('  ok  ', nombre); } else { fail++; console.log('  FALLA', nombre, extra); } }

const puertoLibre = () => new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

const srv = await servir(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const dbg = await puertoLibre();
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'agustina-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${dbg}`, `--user-data-dir=${perfil}`, '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });

async function finalizar(code) {
  try { chrome.kill(); } catch { /* */ }
  srv.close();
  await espera(800);
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* Chrome a veces tarda en soltar archivos */ }
  process.exit(code);
}

try {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json(); const pg = l.find((x) => x.type === 'page'); if (pg) ws = pg.webSocketDebuggerUrl; } catch { await espera(250); }
  }
  if (!ws) throw new Error('Chrome no arrancó');
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0;
  const pend = new Map();
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const { r, j } = pend.get(d.id); pend.delete(d.id); d.error ? j(new Error(d.error.message)) : r(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errores.push('Excepción: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errores.push('console.error: ' + d.params.args.map((a) => a.value || a.description).join(' '));
  };
  const cdp = (method, params = {}) => new Promise((r, j) => { const n = ++id; pend.set(n, { r, j }); sock.send(JSON.stringify({ id: n, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('DOM.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  const ev = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const ir = async (url) => { await cdp('Page.navigate', { url: BASE + url }); await espera(400); await hasta(`document.readyState==='complete' && !document.body.textContent.includes('Cargando…')`); await espera(250); };
  async function hasta(expr, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(`!!(${expr})`)) return true; } catch { /* */ } await espera(120); } throw new Error('Tiempo agotado esperando: ' + expr); }
  const click = async (sel) => { await hasta(`document.querySelector(${JSON.stringify(sel)})`); await ev(`document.querySelector(${JSON.stringify(sel)}).click()`); await espera(250); };
  const escribir = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const texto = () => ev('document.body.textContent');
  async function revisar(nombre) {
    const des = await ev('document.documentElement.scrollWidth - window.innerWidth');
    chk(`${nombre}: sin desborde horizontal`, des <= 0, `(+${des}px)`);
    const est = await ev(`/[\\u2605\\u2606\\u2726\\u2727\\u2728\\u2B50\\u272A-\\u2730]/.test(document.body.textContent) || /estrella|sparkle/i.test(document.body.innerHTML)`);
    chk(`${nombre}: sin estrellas`, !est);
  }
  async function captura(nombre) {
    await revisar(nombre);
    await ev('document.fonts && document.fonts.ready');
    const h = await ev('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 844)');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: Math.min(h, 4000), deviceScaleFactor: 2, mobile: true });
    await espera(300);
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(CAPT, `${nombre}.png`), Buffer.from(data, 'base64'));
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  }
  async function subirArchivo(sel, archivo) {
    const { root } = await cdp('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    await cdp('DOM.setFileInputFiles', { nodeId, files: [archivo] });
  }

  // ------------------------------------------------------------------ 1. Reserva completa
  console.log('1. Reserva completa (paciente)');
  await ir('reservar.html');
  await ev('localStorage.clear(); sessionStorage.clear()');
  await ir('reservar.html');
  chk('inicio: se ve el logo, la firma y las 6 emociones', await ev(`!!document.querySelector('img.logo') && document.body.textContent.includes('Lic. Agustina Arrieta') && document.querySelectorAll('.group6 svg').length===6`));
  chk('inicio: reglas visibles antes de reservar', (await texto()).includes('La seña no se devuelve nunca'));
  await captura('01-reservas-inicio');
  await click('[data-acc=empezar]');
  await click('[data-acc=modalidad][data-id=presencial]');
  await captura('02-reservas-modalidad');
  await click('[data-acc=seguir-modalidad]');
  await hasta(`document.querySelector('.slot')`);
  // los horarios ocupados no aparecen: ninguno de los slots ofrecidos se pisa con un turno de la demo
  const pisa = await ev(`(()=>{const s=JSON.parse(localStorage.getItem('agustina-demo-v1'));return [...document.querySelectorAll('.slot')].some(b=>{const i=Number(b.dataset.ini);return s.turnos.some(t=>t.estado==='reservado'&&t.inicio<i+50*60000&&i<t.fin)})})()`);
  chk('día: no se ofrece ningún horario ocupado', !pisa);
  chk('día: no aparecen nombres de otros pacientes', !(await texto()).match(/Martina|Tomás|Lucía|Joaquín/));
  await click('.slot');
  const iniElegido = await ev(`Number(document.querySelector('.slot.on').dataset.ini)`);
  await captura('03-reservas-dia');
  await click('[data-acc=seguir-dia]');
  await hasta(`document.querySelector('[data-k=nombre]')`);
  const ret = await ev(`JSON.parse(localStorage.getItem('agustina-demo-v1')).retenciones.filter(r=>r.inicio===${iniElegido}&&r.expira>Date.now()).length`);
  chk('el horario queda guardado (retención) mientras completa', ret === 1);
  await escribir('[data-k=nombre]', 'Valentina Prueba');
  await escribir('[data-k=telefono]', '351 555-0177');
  await escribir('[data-k=nacimiento]', '2013-03-01');
  await click('[data-acc=primera][data-v="1"]');
  chk('menor de 15: aviso y botón bloqueado', (await texto()).includes('desde los 15 años') && await ev(`document.querySelector('[data-acc=seguir-datos]').disabled`));
  await escribir('[data-k=nacimiento]', '2010-05-03');
  await click('[data-acc=primera][data-v="1"]');
  chk('15 a 17: pide adulto responsable', !!(await ev(`document.querySelector('[data-k=responsable_nombre]')`)));
  await click('[data-acc=seguir-datos]');
  chk('15 a 17 sin adulto: no avanza', (await texto()).includes('adulto responsable') && !!(await ev(`document.querySelector('.err')`)));
  await escribir('[data-k=responsable_nombre]', 'Laura Prueba (mamá)');
  await escribir('[data-k=responsable_telefono]', '351 555-0199');
  await escribir('[data-k=motivo]', 'Ansiedad antes de exámenes');
  await captura('04-reservas-datos');
  await click('[data-acc=seguir-datos]');
  await hasta(`document.querySelector('[data-acc=transferi]')`);
  chk('reglas: botón deshabilitado hasta aceptar', await ev(`document.querySelector('[data-acc=transferi]').disabled`));
  await click('[data-acc=acepto]');
  await click('[data-acc=copiar-alias]');
  chk('alias Licagustina.mp con botón copiar', (await texto()).includes('Licagustina.mp'));
  await captura('05-reservas-reglas-y-sena');
  await click('[data-acc=transferi]');
  await hasta(`document.querySelector('#archivo')`);
  await subirArchivo('#archivo', path.join(raiz, 'recordatorio/plantilla-recordatorio.jpeg'));
  await hasta(`document.body.textContent.includes('Subido')`);
  await captura('06-reservas-comprobante');
  await click('[data-acc=confirmar]');
  await hasta(`document.body.textContent.includes('¡Listo, Valentina!')`);
  const listo = await texto();
  chk('confirmación con reglas y botón de WhatsApp', listo.includes('La seña no se devuelve') && listo.includes('Cambiar o cancelar por WhatsApp') && !listo.includes('Ver o cambiar') && listo.includes('Seña en revisión'));
  await captura('07-reservas-confirmacion');
  const demo = await ev(`(()=>{const s=JSON.parse(localStorage.getItem('agustina-demo-v1'));const t=s.turnos.find(x=>x.inicio===${iniElegido}&&x.estado==='reservado');return {t, ret:s.retenciones.length, p:s.pacientes.find(p=>p.id===t.paciente_id), n:s.notificaciones.map(n=>n.tipo)}})()`);
  chk('turno creado con comprobante y seña por revisar', demo.t && demo.t.sena === 'por_revisar' && !!demo.t.comprobante);
  chk('retención liberada al reservar', demo.ret === 0);
  chk('paciente con adulto responsable y motivo privado', demo.p.responsable_nombre.startsWith('Laura') && demo.t.motivo.includes('Ansiedad'));
  chk('avisos de reserva y comprobante para Agustina', demo.n.includes('reserva') && demo.n.includes('comprobante'));
  const tokenNuevo = demo.t.token;

  // Volver atrás suelta el horario (el propio no bloquea; el de otros sí)
  await ir('reservar.html');
  await click('[data-acc=empezar]'); await click('[data-acc=modalidad][data-id=presencial]'); await click('[data-acc=seguir-modalidad]');
  await click('.slot'); await click('[data-acc=seguir-dia]');
  await hasta(`document.querySelector('[data-k=nombre]')`);
  await click('[data-acc=volver]');
  chk('volver a elegir horario: el propio sigue disponible', await ev(`!!document.querySelector('.slot.on')`));
  await click('[data-acc=volver]');
  chk('volver a la modalidad: se libera la retención', await ev(`JSON.parse(localStorage.getItem('agustina-demo-v1')).retenciones.length===0`));

  // ------------------------------------------------------------------ 2. Mi turno con más de 24 h: el paciente NO lo cambia solo
  console.log('2. Mi turno (más de 24 h): sin cambio por la página');
  await ir('reservar.html?t=demo-turno-lejos-0001');
  const t2 = await texto();
  chk('mi turno: sin botón de cambiar, con WhatsApp para cambiar o cancelar', !(await ev(`document.querySelector('[data-acc=cambiar]')`)) && t2.includes('Cambiar o cancelar por WhatsApp'));
  await captura('08-mi-turno-mas-de-24h');

  // ------------------------------------------------------------------ 3. Cambio con menos de 24 h
  console.log('3. Cambio con menos de 24 h');
  await ir('reservar.html?t=demo-turno-cerca-0001');
  const t3 = await texto();
  chk('mi turno: sin botón de cambiar y con aviso', !(await ev(`document.querySelector('[data-acc=cambiar]')`)) && t3.includes('Cambiar o cancelar por WhatsApp'));
  await captura('11-mi-turno-menos-de-24h');
  const bloqueo = await ev(`(async()=>{const m=await import('./js/datos-demo.js');const L=await import('./js/logica.js');const d=m.crearDemo();const i=await d.publico.info();
    const mod=i.modalidades.find(x=>x.id==='virtual');let sl=null;for(let k=1;k<20&&!sl;k++){const dia=L.sumarDias(L.diaDe(Date.now()),k);sl=L.slotsLibres({mod,dia,ahora:Date.now(),bloqueos:i.bloqueos,ocupados:await d.publico.ocupado(dia,dia,null),anticipacionHoras:i.anticipacion_horas,horizonteDias:i.horizonte_dias})[0];}
    const r=await d.publico.retener('virtual',sl.inicio,null);try{await d.publico.cambiarTurno('demo-turno-cerca-0001',r.token);return 'CAMBIÓ'}catch(e){await d.publico.soltar(r.token);return e.message}})()`);
  chk('la capa de datos también lo frena (no solo la pantalla)', /menos de 24 h/.test(bloqueo), bloqueo);

  // ------------------------------------------------------------------ 4. Panel
  console.log('4. Panel de Agustina');
  await ir('index.html');
  chk('login con logo', !!(await ev(`document.querySelector('[data-acc=entrar]') && document.querySelector('img.logo')`)));
  await captura('12-panel-login');
  await click('[data-acc=entrar]');
  await hasta(`document.body.textContent.includes('Agustina') && document.querySelector('.nav')`);
  await captura('13-panel-hoy');
  await ir('index.html#pacientes');
  await escribir('#buscar', 'Valentina');
  await espera(200);
  chk('pacientes: aparece la paciente nueva', (await texto()).includes('Valentina Prueba'));
  await captura('14-panel-pacientes');
  await click('a[href^="#paciente/"]');
  await hasta(`document.body.textContent.includes('Notas privadas')`);
  chk('ficha: adulto responsable y motivo privado', (await texto()).includes('Laura Prueba') && (await texto()).includes('Ansiedad antes de exámenes'));
  await captura('15-panel-ficha');
  await ir(`index.html#turno/${demo.t.id}`);
  chk('turno: seña por revisar con comprobante', (await texto()).includes('Por revisar') && !!(await ev(`document.querySelector('[data-acc=ver-comprobante]')`)));
  await click('[data-acc=ver-comprobante]');
  await hasta(`document.querySelector('.visor img')`);
  await captura('16-panel-comprobante');
  await ev(`document.querySelector('.visor').click()`);
  await click('[data-acc=sena-ok]');
  await hasta(`document.body.textContent.includes('Confirmada')`);
  chk('seña confirmada guardada', await ev(`JSON.parse(localStorage.getItem('agustina-demo-v1')).turnos.find(t=>t.id===${demo.t.id}).sena==='confirmada'`));
  await captura('17-panel-turno-sena-confirmada');
  await ir(`reservar.html?t=${tokenNuevo}`);
  chk('la paciente ve "Seña confirmada"', (await texto()).includes('Seña confirmada'));
  await ir('index.html#semana'); await captura('18-panel-semana');
  await ir('index.html#vida'); await captura('19-panel-mi-vida');
  await click('[data-acc=mas]'); await hasta(`document.querySelector('.hoja [data-k=titulo]')`);
  await escribir('.hoja [data-k=titulo]', 'Dentista');
  await escribir('.hoja [data-k=hora_inicio]', '10:00');
  await escribir('.hoja [data-k=hora_fin]', '11:00');
  await click('[data-acc=ev-bloquea]');
  await captura('20-panel-nuevo-evento');
  await click('[data-acc=guardar-evento]');
  chk('evento de Mi vida guardado (bloquea pacientes)', await ev(`JSON.parse(localStorage.getItem('agustina-demo-v1')).eventos.some(e=>e.titulo==='Dentista'&&e.hora_inicio==='10:00'&&e.bloquea)`));
  await ir('index.html#ajustes'); await captura('21-panel-ajustes');
  await ir('index.html#ajustes/horarios'); await captura('22-panel-horarios');
  await ir('index.html#ajustes/avisos'); await captura('23-panel-avisos');
  await ir('index.html#ajustes/servicio'); await captura('24-panel-servicio-y-sena');
  await ir('index.html#ajustes/recordatorio'); await espera(800); await captura('25-panel-ajuste-recordatorio');

  // ------------------------------------------------------------------ 5. Recordatorio
  console.log('5. Recordatorio a pacientes');
  await ir('index.html#hoy');
  chk('Hoy muestra el recordatorio pendiente', (await texto()).includes('Recordale a'));
  const recId = await ev(`(()=>{const a=document.querySelector('a[href^="#recordar/"]');return a?a.getAttribute('href').split('/')[1]:null})()`);
  await ir(`index.html#recordar/${recId}`);
  await hasta(`document.getElementById('img-rec') && document.getElementById('img-rec').width>1000`);
  await espera(500);
  // ¿El texto quedó dibujado sobre las líneas DÍA y HORA? Comparación de píxeles contra la plantilla vacía.
  const dif = await ev(`(async()=>{const c=document.getElementById('img-rec');const img=new Image();img.src='recordatorio/plantilla-recordatorio.jpeg';await img.decode();
    const b=document.createElement('canvas');b.width=c.width;b.height=c.height;b.getContext('2d').drawImage(img,0,0);
    const zona=(cv,fy)=>cv.getContext('2d').getImageData(Math.round(cv.width*0.27),Math.round(cv.height*fy-60),Math.round(cv.width*0.62),55).data;
    const cuenta=(fy)=>{const a=zona(c,fy),z=zona(b,fy);let n=0;for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-z[i])+Math.abs(a[i+1]-z[i+1])+Math.abs(a[i+2]-z[i+2])>90)n++;}return n};
    const fuera=(()=>{const a=c.getContext('2d').getImageData(0,0,c.width,200).data,z=b.getContext('2d').getImageData(0,0,c.width,200).data;let n=0;for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-z[i])>40)n++;}return n})();
    return {dia:cuenta(0.4565),hora:cuenta(0.5474),fuera}})()`);
  chk('imagen: escribió el día sobre la línea DÍA', dif.dia > 800, JSON.stringify(dif));
  chk('imagen: escribió la hora sobre la línea HORA', dif.hora > 400, JSON.stringify(dif));
  chk('imagen: el resto de la plantilla quedó igual', dif.fuera < 50, JSON.stringify(dif));
  const msg = await ev(`document.getElementById('txt-rec').value`);
  chk('mensaje con nombre, día, hora y la regla de 24 h', /^Hola \w+! Te recuerdo tu sesión el \S+ \d+ \w+ a las \d\d:\d\d/.test(msg) && msg.includes('se abona igualmente'), msg);
  await captura('26-panel-recordatorio');
  await ev(`window.__compartido=null; navigator.canShare=()=>true; navigator.share=async(d)=>{window.__compartido={n:d.files.length,tipo:d.files[0].type,tam:d.files[0].size,texto:d.text}}; try{navigator.clipboard.writeText=async()=>{}}catch(e){}`);
  await click('[data-acc=compartir-rec]');
  await hasta('window.__compartido');
  const comp = await ev('window.__compartido');
  chk('“Mandar por WhatsApp” comparte imagen PNG + texto', comp.n === 1 && comp.tipo === 'image/png' && comp.tam > 50000 && comp.texto === msg, JSON.stringify({ ...comp, texto: undefined }));
  await espera(400);
  chk('recordatorio marcado como enviado', await ev(`JSON.parse(localStorage.getItem('agustina-demo-v1')).recordatorios.some(r=>r.turno_id===${recId}&&r.estado==='enviado')`));
  await captura('27-panel-recordatorio-enviado');

  chk('sin errores de JavaScript', errores.length === 0, errores.join('\n'));
} catch (e) {
  fail++;
  console.log('  FALLA (se cortó la prueba):', e.message);
  if (errores.length) console.log(errores.join('\n'));
}
console.log(`\n${ok} ok, ${fail} con falla`);
await finalizar(fail ? 1 : 0);
