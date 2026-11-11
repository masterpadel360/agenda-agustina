// =====================================================================
// Configuración. Es lo único que hay que tocar para salir en vivo (ver LEEME.md).
// - supabaseUrl / supabaseAnonKey: Supabase → Project Settings → API
//   (Project URL y la clave "anon" / "publishable"). Si quedan vacías,
//   la app arranca en MODO DEMO con datos inventados.
// - vapidPublic: la clave pública de avisos (node herramientas/generar-vapid.mjs).
// La anon key es pública por diseño: la seguridad está en las reglas de
// supabase/schema.sql. NUNCA pegues acá la "service_role" / "secret" key.
// =====================================================================
window.AGUSTINA_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  vapidPublic: '',
};
