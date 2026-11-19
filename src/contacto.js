// Recibe el formulario de contacto y el de la newsletter
// y los manda por correo a info@ usando la API de Resend (plan gratuito).
//
// Variables que hay que poner en Cloudflare (el Worker → Settings → Variables and Secrets):
//   RESEND_API_KEY  (secreto)  clave de Resend
//   EMAIL_FROM                 p. ej.  Web Grupo Sobremesa <web@gruposobremesa.com>
//   EMAIL_TO                   opcional; por defecto info@gruposobremesa.com
import { revisarEnvio, componerCorreo } from '../lib/formulario.mjs';

const DESTINO_POR_DEFECTO = 'info@gruposobremesa.com';

function respuesta(request, tipo, ok, error, status) {
  const quiereJSON = (request.headers.get('Accept') || '').includes('application/json');
  if (quiereJSON) {
    return new Response(JSON.stringify(ok ? { ok: true } : { ok: false, error }), {
      status: ok ? 200 : status || 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  // Sin JavaScript: se vuelve a la página de contacto con el resultado en la dirección
  const destino = new URL('/contacto/', request.url);
  destino.searchParams.set(ok ? 'enviado' : 'error', tipo);
  destino.hash = tipo === 'newsletter' ? 'newsletter' : 'form-contacto';
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
  // A los robots se les dice que todo ha ido bien, pero no se envía nada
  if (revision.spam) return respuesta(request, revision.tipo, true);
  if (revision.error) return respuesta(request, revision.tipo, false, revision.error, 400);

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return respuesta(request, revision.tipo, false,
      'El formulario todavía no está conectado. Escríbenos directamente a ' + (env.EMAIL_TO || DESTINO_POR_DEFECTO) + '.', 503);
  }

  const correo = componerCorreo(revision, { ip: request.headers.get('CF-Connecting-IP') });
  const envio = await fetch('https://api.resend.com/emails', {
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

  if (!envio || !envio.ok) {
    return respuesta(request, revision.tipo, false,
      'No se ha podido enviar ahora mismo. Inténtalo en unos minutos o escríbenos a ' + (env.EMAIL_TO || DESTINO_POR_DEFECTO) + '.', 502);
  }
  return respuesta(request, revision.tipo, true);
}

export function onRequest() {
  return new Response('Método no permitido', { status: 405, headers: { Allow: 'POST' } });
}
