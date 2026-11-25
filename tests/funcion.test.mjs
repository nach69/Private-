// Prueba el formulario del Worker tal cual, con un envío de correo simulado.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../src/contacto.js';
import { exportarCSV } from '../src/newsletter.js';

// Base de datos D1 simulada: guarda las altas en memoria con el mismo comportamiento que la tabla real
function d1Falsa({ falla = false } = {}) {
  const filas = new Map();
  return {
    filas,
    prepare(sql) {
      const stmt = {
        args: [],
        bind(...a) { stmt.args = a; return stmt; },
        async run() {
          if (falla) throw new Error('D1 caída');
          if (/^INSERT INTO suscriptores/.test(sql.trim())) {
            const [email, alta_en, ip, pagina, texto_aceptado] = stmt.args;
            const prev = filas.get(email);
            if (prev && prev.baja_en === null) return;
            filas.set(email, { email, alta_en, ip, pagina, texto_aceptado, baja_en: null });
          }
        },
        async all() { return { results: [...filas.values()] }; }
      };
      return stmt;
    }
  };
}

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

test('newsletter: se guarda en la base de datos aunque no haya correo configurado', async () => {
  const DB = d1Falsa();
  const res = await onRequestPost({ request: peticion({ tipo: 'newsletter', origen: '/', t: String(Date.now() - 10000), email: 'Ana@Ejemplo.com' }), env: { DB } });
  assert.equal(res.status, 200);
  const fila = DB.filas.get('ana@ejemplo.com');
  assert.equal(fila.ip, '9.9.9.9');
  assert.equal(fila.pagina, '/');
  assert.match(fila.texto_aceptado, /Al apuntarte/);
});

test('newsletter: apuntarse dos veces no duplica ni cambia la fecha de la primera alta', async () => {
  const DB = d1Falsa();
  const alta = () => onRequestPost({ request: peticion({ tipo: 'newsletter', origen: '/', t: String(Date.now() - 10000), email: 'ana@ejemplo.com' }), env: { DB } });
  await alta();
  const primera = DB.filas.get('ana@ejemplo.com').alta_en;
  await new Promise((r) => setTimeout(r, 5));
  await alta();
  assert.equal(DB.filas.size, 1);
  assert.equal(DB.filas.get('ana@ejemplo.com').alta_en, primera);
});

test('newsletter: si la base de datos falla pero el correo funciona, el alta llega a info@', async (t) => {
  const f = mock.method(globalThis, 'fetch', async () => new Response('{"id":"1"}', { status: 200 }));
  t.after(() => f.mock.restore());
  const res = await onRequestPost({ request: peticion({ tipo: 'newsletter', origen: '/', t: String(Date.now() - 10000), email: 'a@b.es' }), env: { ...env, DB: d1Falsa({ falla: true }) } });
  assert.equal(res.status, 200);
  assert.match(JSON.parse(f.mock.calls[0].arguments[1].body).subject, /Alta en la newsletter/);
});

test('newsletter: sin base de datos ni correo, se dice y no se finge', async () => {
  const res = await onRequestPost({ request: peticion({ tipo: 'newsletter', origen: '/', t: String(Date.now() - 10000), email: 'a@b.es' }), env: {} });
  assert.equal(res.status, 503);
});

test('sin JavaScript: vuelve a la página desde la que se apuntó', async () => {
  const res = await onRequestPost({ request: peticion({ tipo: 'newsletter', origen: '/eventos/', t: String(Date.now() - 10000), email: 'a@b.es' }, { Accept: 'text/html' }), env: { DB: d1Falsa() } });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('Location'), 'https://gruposobremesa.com/eventos/?enviado=newsletter#unete');
});

test('descarga de la lista: apagada sin clave, protegida con clave y en CSV', async () => {
  const DB = d1Falsa();
  await onRequestPost({ request: peticion({ tipo: 'newsletter', origen: '/', t: String(Date.now() - 10000), email: 'ana@ejemplo.com' }), env: { DB } });
  const url = (c) => new Request('https://gruposobremesa.com/api/newsletter.csv' + (c ? '?clave=' + c : ''));
  assert.equal((await exportarCSV(url('x'), { DB })).status, 404);
  assert.equal((await exportarCSV(url('mala'), { DB, NEWSLETTER_CLAVE: 'buena' })).status, 403);
  const ok = await exportarCSV(url('buena'), { DB, NEWSLETTER_CLAVE: 'buena' });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('Content-Type'), /text\/csv/);
  assert.match(await ok.text(), /ana@ejemplo\.com;/);
});
