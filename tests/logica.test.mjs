import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hoyEnMadrid, eventosFuturos, erroresEvento, fechaCorta, fechaLarga, ordenarCarpetas } from '../scripts/lib.mjs';
import { revisarEnvio, componerCorreo, TEXTO_CONSENTIMIENTO_NEWSLETTER } from '../lib/formulario.mjs';

test('hoy en Madrid cambia a medianoche de Valencia, no de UTC', () => {
  assert.equal(hoyEnMadrid(new Date('2026-11-27T22:59:00Z')), '2026-11-27');
  assert.equal(hoyEnMadrid(new Date('2026-11-27T23:01:00Z')), '2026-11-28');
  assert.equal(hoyEnMadrid(new Date('2026-07-01T22:30:00Z')), '2026-07-02'); // horario de verano
});

test('solo eventos de hoy en adelante, ordenados', () => {
  const evs = [
    { fecha: '2026-12-22', hora: null }, { fecha: '2026-11-10' },
    { fecha: '2026-11-28', hora: '20:00' }, { fecha: '2026-11-28', hora: '18:00' }
  ];
  assert.deepEqual(eventosFuturos(evs, '2026-11-28').map((e) => e.fecha + (e.hora || '')),
    ['2026-11-2818:00', '2026-11-2820:00', '2026-12-22']);
  assert.deepEqual(eventosFuturos(evs, '2027-01-01'), []);
});

test('detecta errores típicos al añadir un evento', () => {
  const ids = ['veleta', 'solea'];
  assert.deepEqual(erroresEvento({ marca: 'veleta', fecha: '2026-11-28' }, ids), []);
  assert.equal(erroresEvento({ marca: 'veletta', fecha: '28/11/2026', hora: '8pm', entradas: 'www.x.com' }, ids).length, 4);
});

test('fechas en español', () => {
  assert.equal(fechaCorta('2026-11-28'), 'sáb 28 nov');
  assert.equal(fechaLarga('2026-12-22'), 'martes 22 de diciembre');
});

test('galería: carpetas fechadas primero, de más nueva a más vieja', () => {
  assert.deepEqual(ordenarCarpetas(['fotos-web-base', '2026-11-28-basto', '2026-12-22']),
    ['2026-12-22', '2026-11-28-basto', 'fotos-web-base']);
});

test('los datos reales del repositorio son válidos', () => {
  const marcas = JSON.parse(readFileSync(new URL('../datos/marcas.json', import.meta.url)));
  const eventos = JSON.parse(readFileSync(new URL('../datos/eventos.json', import.meta.url)));
  for (const ev of eventos) assert.deepEqual(erroresEvento(ev, marcas.map((m) => m.id)), []);
});

const AHORA = Date.parse('2026-11-19T12:00:00Z');
const base = { tipo: 'contacto', t: String(AHORA - 60000), web: '', nombre: 'Lucía', email: 'Lucia@Ejemplo.com', soy: 'marca', mensaje: 'Hola, queremos patrocinar un evento.', privacidad: 'si' };

test('formulario de contacto correcto', () => {
  const r = revisarEnvio(base, AHORA);
  assert.deepEqual(r.datos, { nombre: 'Lucía', email: 'lucia@ejemplo.com', soy: 'marca', mensaje: 'Hola, queremos patrocinar un evento.' });
});

test('antispam: campo trampa, envío demasiado rápido y muchos enlaces', () => {
  assert.equal(revisarEnvio({ ...base, web: 'http://spam' }, AHORA).spam, true);
  assert.equal(revisarEnvio({ ...base, t: String(AHORA - 1000) }, AHORA).spam, true);
  assert.equal(revisarEnvio({ ...base, t: '' }, AHORA).spam, true);
  assert.equal(revisarEnvio({ ...base, mensaje: 'http://a http://b http://c http://d' }, AHORA).spam, true);
});

test('errores de formulario', () => {
  assert.ok(revisarEnvio({ ...base, privacidad: undefined }, AHORA).error);
  assert.ok(revisarEnvio({ ...base, soy: 'hacker' }, AHORA).error);
  assert.ok(revisarEnvio({ ...base, email: 'no-es-email' }, AHORA).error);
  assert.ok(revisarEnvio({ ...base, mensaje: 'corto' }, AHORA).error);
});

test('newsletter: la casilla es obligatoria y el correo guarda fecha, hora, IP y texto', () => {
  const nl = { tipo: 'newsletter', t: String(AHORA - 9000), email: 'a@b.es' };
  assert.ok(revisarEnvio(nl, AHORA).error);
  const r = revisarEnvio({ ...nl, consentimiento: 'si' }, AHORA);
  const c = componerCorreo(r, { ip: '1.2.3.4', fecha: new Date(AHORA) });
  assert.match(c.texto, /19\/11\/2026, 13:00:00 \(hora de Madrid\)/);
  assert.match(c.texto, /1\.2\.3\.4/);
  assert.ok(c.texto.includes(TEXTO_CONSENTIMIENTO_NEWSLETTER));
});

test('el texto de consentimiento guardado coincide con el de la web', () => {
  const html = readFileSync(new URL('../dist/contacto/index.html', import.meta.url), 'utf8');
  const label = html.match(/<label for="nl-consentimiento">([\s\S]*?)<\/label>/)[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(label, TEXTO_CONSENTIMIENTO_NEWSLETTER);
});

test('el asunto no admite saltos de línea (inyección de cabeceras)', () => {
  const r = revisarEnvio({ ...base, nombre: 'Ana\r\nBcc: x@y.z' }, AHORA);
  assert.ok(!componerCorreo(r).asunto.includes('\n'));
});
