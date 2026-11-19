// Lógica pura del formulario de contacto y de la newsletter (sin red), para poder probarla.
// La usa functions/api/contacto.js, que es la función de Cloudflare que recibe los envíos.

import config from '../datos/config.json' with { type: 'json' };

export const TIPOS_SOY = ['asistente', 'marca', 'local', 'patrocinador'];

// Debe coincidir con el texto de la casilla en plantillas/contacto.html (se guarda como prueba del consentimiento).
export const TEXTO_CONSENTIMIENTO_NEWSLETTER =
  `Quiero recibir por email las novedades y eventos de ${config.nombre}. He leído la política de privacidad. Puedo darme de baja cuando quiera.`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIEMPO_MINIMO_MS = 3000;          // un humano tarda más de 3 s en rellenar
const TIEMPO_MAXIMO_MS = 24 * 3600e3;   // formularios abiertos más de un día: se piden recargar

const limpiarLinea = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim();
const limpiarTexto = (s) => String(s ?? '').replace(/\r\n?/g, '\n').trim();

/**
 * Revisa lo que llega del formulario.
 * Devuelve { spam: true } si parece un robot (se responde «ok» sin enviar nada),
 * { error: '…' } si falta algo, o { datos } si todo está bien.
 */
export function revisarEnvio(campos, ahora = Date.now()) {
  const tipo = campos.tipo === 'newsletter' ? 'newsletter' : 'contacto';
  if (limpiarLinea(campos.web)) return { spam: true, tipo };
  const t = Number(campos.t);
  if (!t || ahora - t < TIEMPO_MINIMO_MS) return { spam: true, tipo };
  if (ahora - t > TIEMPO_MAXIMO_MS) return { error: 'El formulario ha caducado. Recarga la página y vuelve a enviarlo.', tipo };

  const email = limpiarLinea(campos.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 150) return { error: 'Revisa el email.', tipo };

  if (tipo === 'newsletter') {
    if (campos.consentimiento !== 'si') return { error: 'Falta marcar la casilla de consentimiento.', tipo };
    return { tipo, datos: { email } };
  }

  const nombre = limpiarLinea(campos.nombre);
  const soy = limpiarLinea(campos.soy);
  const mensaje = limpiarTexto(campos.mensaje);
  if (nombre.length < 2 || nombre.length > 100) return { error: 'Revisa el nombre.', tipo };
  if (!TIPOS_SOY.includes(soy)) return { error: 'Elige qué eres en el desplegable.', tipo };
  if (mensaje.length < 10 || mensaje.length > 3000) return { error: 'El mensaje debe tener entre 10 y 3.000 caracteres.', tipo };
  if (campos.privacidad !== 'si') return { error: 'Falta aceptar la política de privacidad.', tipo };
  // Muchos enlaces en un mensaje corto = casi seguro spam
  if ((mensaje.match(/https?:\/\//g) || []).length > 3) return { spam: true, tipo };
  return { tipo, datos: { nombre, email, soy, mensaje } };
}

/** Fecha y hora legibles en Valencia: «19/11/2026, 12:34:56 (hora de Madrid)». */
export function fechaHoraMadrid(fecha = new Date()) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(fecha) + ' (hora de Madrid)';
}

const SOY_TEXTO = { asistente: 'Asistente', marca: 'Marca', local: 'Local', patrocinador: 'Patrocinador' };

/** Compone el correo que llega a info@. */
export function componerCorreo({ tipo, datos }, meta = {}) {
  const cuando = fechaHoraMadrid(meta.fecha || new Date());
  if (tipo === 'newsletter') {
    return {
      asunto: `Alta en la newsletter: ${datos.email}`,
      responderA: datos.email,
      texto: [
        'Nueva alta en la newsletter desde la web.',
        '',
        `Email: ${datos.email}`,
        `Fecha y hora del consentimiento: ${cuando}`,
        `IP: ${meta.ip || 'desconocida'}`,
        `Texto aceptado: «${TEXTO_CONSENTIMIENTO_NEWSLETTER}»`,
        '',
        'Guarda este correo: es la prueba del consentimiento. Cuando se conecte Mailchimp, este alta se pasará allí.'
      ].join('\n')
    };
  }
  return {
    asunto: `[Web] ${SOY_TEXTO[datos.soy]}: ${datos.nombre}`,
    responderA: datos.email,
    texto: [
      `Nuevo mensaje desde el formulario de la web (${cuando}).`,
      '',
      `Nombre: ${datos.nombre}`,
      `Email: ${datos.email}`,
      `Soy: ${SOY_TEXTO[datos.soy]}`,
      '',
      'Mensaje:',
      datos.mensaje,
      '',
      '—',
      'Responde a este correo para contestar directamente a esta persona.'
    ].join('\n')
  };
}
