// Genera las claves VAPID para los avisos push (sin npm). Uso: node herramientas/generar-vapid.mjs
// VAPID_PUBLIC  → va en config.js (vapidPublic) Y como secreto de la función "avisos".
// VAPID_PRIVATE → SOLO como secreto de la función "avisos". Nunca en el repo ni en config.js.
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
console.log('VAPID_PUBLIC=' + b64u(pub));
console.log('VAPID_PRIVATE=' + jwk.d);
console.log('VAPID_SUBJECT=mailto:lic.agustina.arrieta@gmail.com');
