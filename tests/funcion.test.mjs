// Prueba la función de Cloudflare tal cual, con un envío de correo simulado.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contacto.js';

const URL_WEB = 'https://gruposobremesa.com/api/contacto';
function peticion(campos, cabeceras = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return new Request(URL_WEB, { method: 'POST', body: fd, headers: { Accept: 'application/json', Origin: 'https://gruposobremesa.com', 'CF-Connecting-IP': '9.9.9.9', ...cabeceras } });
}
const campos = () => ({ tipo: 'contacto', t: String(Date.now() - 10000), web: '', nombre: 'Lucía', email: 'lucia@ejemplo.com', soy: 'local', mensaje: 'Tenemos un local en Ruzafa.', privacidad: 'si' });
const env = { RESEND_API_KEY: 'clave-falsa', EMAIL_FROM: 'Web <web@gruposobremesa.com>' };

test('envía el mensaje a info@ con responder-a la persona', async (t) => {
  const f = mock.method(globalThis, 'fetch', async () => new Response('{"id":"1"}', { status: 200 }));
  t.after(() => f.mock.restore());
  const res = await onRequestPost({ request: peticion(campos()), env });
  assert.equal(res.status, 200);
  const cuerpo = JSON.parse(f.mock.calls[0].arguments[1].body);
  assert.deepEqual(cuerpo.to, ['info@gruposobremesa.com']);
  assert.equal(cuerpo.reply_to, 'lucia@ejemplo.com');
  assert.match(cuerpo.subject, /Local: Lucía/);
});

test('un robot recibe «ok» pero no se envía nada', async (t) => {
  const f = mock.method(globalThis, 'fetch', async () => new Response('{}'));
  t.after(() => f.mock.restore());
  const res = await onRequestPost({ request: peticion({ ...campos(), web: 'x' }), env });
  assert.equal(res.status, 200);
  assert.equal(f.mock.callCount(), 0);
});

test('rechaza envíos desde otra web', async () => {
  const res = await onRequestPost({ request: peticion(campos(), { Origin: 'https://malo.com' }), env });
  assert.equal(res.status, 403);
});

test('sin clave configurada avisa en vez de fingir que envía', async () => {
  const res = await onRequestPost({ request: peticion(campos()), env: {} });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /info@gruposobremesa\.com/);
});

test('si falla el proveedor de correo, se dice', async (t) => {
  const f = mock.method(globalThis, 'fetch', async () => new Response('error', { status: 500 }));
  t.after(() => f.mock.restore());
  const res = await onRequestPost({ request: peticion(campos()), env });
  assert.equal(res.status, 502);
});

test('sin JavaScript: redirige a contacto con el resultado', async (t) => {
  const f = mock.method(globalThis, 'fetch', async () => new Response('{}'));
  t.after(() => f.mock.restore());
  const res = await onRequestPost({ request: peticion({ tipo: 'newsletter', t: String(Date.now() - 10000), email: 'a@b.es', consentimiento: 'si' }, { Accept: 'text/html' }), env });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('Location'), 'https://gruposobremesa.com/contacto/?enviado=newsletter#newsletter');
});
