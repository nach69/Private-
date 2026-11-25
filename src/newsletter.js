// Lista de la newsletter guardada en Cloudflare D1 (base de datos del propio Worker, en la UE).
//
// - La base de datos la crea Cloudflare sola en la primera publicación (wrangler.jsonc → d1_databases, binding DB).
// - La tabla se crea sola en la primera alta (CREATE TABLE IF NOT EXISTS): no hay que preparar nada a mano.
// - Para descargar la lista en CSV (separado por «;», como lo abre el Excel en español; también vale para Google Sheets):
//     https://gruposobremesa.com/api/newsletter.csv?clave=LA_CLAVE
//   donde LA_CLAVE es el secreto NEWSLETTER_CLAVE del Worker (Cloudflare → el Worker → Settings → Variables and Secrets).
//   Sin ese secreto, la descarga está apagada (responde 404).
// - También se puede ver en Cloudflare → Storage & Databases → D1 → sobremesa-newsletter → Console.

const CREAR_TABLA = `CREATE TABLE IF NOT EXISTS suscriptores (
  email TEXT PRIMARY KEY,
  alta_en TEXT NOT NULL,
  ip TEXT,
  pagina TEXT,
  texto_aceptado TEXT NOT NULL,
  baja_en TEXT
)`;

/**
 * Guarda (o reactiva) un alta. Si el email ya estaba, se conserva la fecha de la primera alta
 * y se borra una baja anterior, porque la persona se vuelve a apuntar.
 */
export async function guardarAlta(db, { email, ip, pagina, texto, fecha = new Date() }) {
  await db.prepare(CREAR_TABLA).run();
  await db.prepare(
    `INSERT INTO suscriptores (email, alta_en, ip, pagina, texto_aceptado)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(email) DO UPDATE SET
       baja_en = NULL,
       alta_en = CASE WHEN suscriptores.baja_en IS NULL THEN suscriptores.alta_en ELSE excluded.alta_en END,
       ip = CASE WHEN suscriptores.baja_en IS NULL THEN suscriptores.ip ELSE excluded.ip END,
       pagina = CASE WHEN suscriptores.baja_en IS NULL THEN suscriptores.pagina ELSE excluded.pagina END,
       texto_aceptado = CASE WHEN suscriptores.baja_en IS NULL THEN suscriptores.texto_aceptado ELSE excluded.texto_aceptado END`
  ).bind(email, fecha.toISOString(), ip || null, pagina || null, texto).run();
}

const csvCampo = (v) => {
  const s = v == null ? '' : String(v);
  // Evita que Excel interprete un email raro como fórmula
  const seguro = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};

/** Compara la clave sin dar pistas por el tiempo de respuesta. */
async function mismaClave(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** GET /api/newsletter.csv?clave=… → la lista completa en CSV. */
export async function exportarCSV(request, env) {
  const clave = new URL(request.url).searchParams.get('clave') || '';
  if (!env.NEWSLETTER_CLAVE || !env.DB) return new Response('No encontrado', { status: 404 });
  if (!(await mismaClave(clave, env.NEWSLETTER_CLAVE))) return new Response('Clave incorrecta', { status: 403 });

  await env.DB.prepare(CREAR_TABLA).run();
  const { results = [] } = await env.DB.prepare(
    'SELECT email, alta_en, baja_en, pagina, ip, texto_aceptado FROM suscriptores ORDER BY alta_en'
  ).all();
  const cabecera = ['email', 'alta (UTC)', 'baja (UTC)', 'pagina', 'ip', 'texto aceptado'];
  const filas = results.map((r) => [r.email, r.alta_en, r.baja_en, r.pagina, r.ip, r.texto_aceptado].map(csvCampo).join(';'));
  const csv = '\uFEFF' + [cabecera.join(';'), ...filas].join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="newsletter-sobremesa-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex'
    }
  });
}
