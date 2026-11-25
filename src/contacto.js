// Recibe el formulario de contacto y las altas de la newsletter («Únete a la sobremesa»).
//
// - Newsletter: el alta se GUARDA en la base de datos D1 del Worker (src/newsletter.js), que es la lista buena.
//   Además, si el correo está configurado, se avisa a info@. Basta con que una de las dos cosas funcione.
// - Contacto: el mensaje se manda por correo a info@ usando la API de Resend (plan gratuito).
//
// Variables que hay que poner en Cloudflare (el Worker → Settings → Variables and Secrets):
//   RESEND_API_KEY    (secreto)  clave de Resend
//   EMAIL_FROM                   p. ej.  Web Grupo Sobremesa <web@gruposobremesa.com>
//   EMAIL_TO                     opcional; por defecto info@gruposobremesa.com
//   NEWSLETTER_CLAVE  (secreto)  clave para descargar la lista en /api/newsletter.csv?clave=…
import { revisarEnvio, componerCorreo, rutaOrigen, TEXTO_ALTA_NEWSLETTER } from '../lib/formulario.mjs';
import { guardarAlta } from './newsletter.js';

const DESTINO_POR_DEFECTO = 'info@gruposobremesa.com';

function respuesta(request, tipo, ok, error, status, pagina) {
  const quiereJSON = (request.headers.get('Accept') || '').includes('application/json');
  if (quiereJSON) {
    return new Response(JSON.stringify(ok ? { ok: true } : { ok: false, error }), {
      status: ok ? 200 : status || 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  // Sin JavaScript: se vuelve a la página de origen con el resultado en la dirección
  const destino = new URL(tipo === 'newsletter' ? (pagina || '/') : '/contacto/', request.url);
  destino.searchParams.set(ok ? 'enviado' : 'error', tipo);
  destino.hash = tipo === 'newsletter' ? 'unete' : 'form-contacto';
  return Response.redirect(destino.toString(), 303);
}

export async function onRequestPost({ request, env }) {
  // Solo aceptamos envíos desde la propia web
  const origen = request.headers.get('Origin');
  if (origen && new URL(origen).host !== new URL(request.url).host) {
    return new Response('Origen no permitido', { status: 403 });
  }

  let campos;
  try {
    const form = await request.formData();
    campos = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
  } catch {
    return respuesta(request, 'contacto', false, 'No se ha podido leer el formulario.', 400);
  }

  const revision = revisarEnvio(campos);
  const pagina = rutaOrigen(campos.origen);
  // A los robots se les dice que todo ha ido bien, pero no se envía nada
  if (revision.spam) return respuesta(request, revision.tipo, true, null, 200, pagina);
  if (revision.error) return respuesta(request, revision.tipo, false, revision.error, 400, pagina);

  const ip = request.headers.get('CF-Connecting-IP');
  if (revision.tipo === 'newsletter') return altaNewsletter(request, env, revision, ip);

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return respuesta(request, revision.tipo, false,
      'El formulario todavía no está conectado. Escríbenos directamente a ' + (env.EMAIL_TO || DESTINO_POR_DEFECTO) + '.', 503);
  }

  const correo = componerCorreo(revision, { ip });
  const envio = await enviarCorreo(env, correo);

  if (!envio || !envio.ok) {
    return respuesta(request, revision.tipo, false,
      'No se ha podido enviar ahora mismo. Inténtalo en unos minutos o escríbenos a ' + (env.EMAIL_TO || DESTINO_POR_DEFECTO) + '.', 502);
  }
  return respuesta(request, revision.tipo, true);
}

function enviarCorreo(env, correo) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [env.EMAIL_TO || DESTINO_POR_DEFECTO],
      reply_to: correo.responderA,
      subject: correo.asunto,
      text: correo.texto
    })
  }).catch(() => null);
}

// Alta en la newsletter: primero se guarda en la base de datos (la lista buena); después, si hay correo configurado,
// se avisa a info@. Si se ha guardado, la persona ve «¡Hecho!» aunque el aviso falle.
async function altaNewsletter(request, env, revision, ip) {
  const pagina = revision.datos.origen;
  const fecha = new Date();
  let guardado = false;
  if (env.DB) {
    try {
      await guardarAlta(env.DB, { email: revision.datos.email, ip, pagina, texto: TEXTO_ALTA_NEWSLETTER, fecha });
      guardado = true;
    } catch (e) {
      console.error('Newsletter: no se ha podido guardar el alta en D1', e);
    }
  }
  let avisado = false;
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    const envio = await enviarCorreo(env, componerCorreo(revision, { ip, fecha }));
    avisado = !!(envio && envio.ok);
  }
  if (guardado || avisado) return respuesta(request, 'newsletter', true, null, 200, pagina);
  const destino = env.EMAIL_TO || DESTINO_POR_DEFECTO;
  return respuesta(request, 'newsletter', false,
    'No hemos podido apuntarte ahora mismo. Inténtalo en unos minutos o escríbenos a ' + destino + '.', 503, pagina);
}

export function onRequest() {
  return new Response('Método no permitido', { status: 405, headers: { Allow: 'POST' } });
}
