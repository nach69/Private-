// Comprobaciones en un navegador real (Chromium + Playwright) sobre dist/.
// Uso: npm run test:navegador
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(DIST, ruta);
  if (!archivo.startsWith(DIST) || !fs.existsSync(archivo)) { res.writeHead(404); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  fs.createReadStream(archivo).pipe(res);
});

let fallos = 0;
const ok = (cond, texto) => { console.log((cond ? 'OK   ' : 'FALLA') + ' ' + texto); if (!cond) fallos++; };

(async () => {
  await new Promise((r) => servidor.listen(0, r));
  const BASE = `http://localhost:${servidor.address().port}`;
  const navegador = await chromium.launch();

  // 1. Nada de terceros y sin errores
  const ctx = await navegador.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const externas = []; const errores = [];
  p.on('request', (r) => { if (!r.url().startsWith(BASE)) externas.push(r.url()); });
  p.on('pageerror', (e) => errores.push(e.message));
  for (const ruta of ['/', '/eventos/', '/vosotros/', '/contacto/', '/aviso-legal/', '/privacidad/', '/cookies/']) {
    const r = await p.goto(BASE + ruta, { waitUntil: 'networkidle' });
    ok(r.status() === 200, `${ruta} carga`);
    const og = await p.$eval('meta[property="og:image"]', (m) => m.content);
    ok(og.startsWith('https://gruposobremesa.com/'), `${ruta} og:image absoluta`);
    ok(await p.$$eval('footer a[href="/aviso-legal/"], footer a[href="/privacidad/"], footer a[href="/cookies/"]', (a) => a.length) === 3, `${ruta} legales en el pie`);
  }
  ok(externas.length === 0, 'no se carga nada de otras webs' + (externas.length ? ': ' + externas.join(', ') : ''));
  ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));

  // 2. Banner de cookies: aparece, Denegar lo cierra y se recuerda
  await p.goto(BASE + '/');
  ok(await p.isVisible('#aviso-cookies'), 'aviso de cookies visible la primera vez');
  await p.click('[data-cookies="denegar"]');
  ok(!(await p.isVisible('#aviso-cookies')), '«Denegar» cierra el aviso');
  await p.reload();
  ok(!(await p.isVisible('#aviso-cookies')), 'la elección se recuerda');

  // 3. Enlaces internos sin romper
  const enlaces = new Set();
  for (const ruta of ['/', '/eventos/', '/vosotros/', '/contacto/']) {
    await p.goto(BASE + ruta);
    (await p.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href')))).forEach((h) => enlaces.add(h.split('#')[0].split('?')[0] || '/'));
  }
  for (const h of enlaces) {
    const r = await p.request.get(BASE + h);
    ok(r.status() === 200, `enlace ${h}`);
  }

  // 4. Desplegable «Soy» preseleccionado y validación del formulario
  await p.goto(BASE + '/contacto/?soy=patrocinador');
  ok(await p.inputValue('#cf-soy') === 'patrocinador', 'Colabora → Contacto llega con «Patrocinador» elegido');
  ok(!(await p.isChecked('#nl-consentimiento')), 'casilla de newsletter sin marcar');
  await p.click('#form-contacto [type=submit]');
  ok((await p.textContent('#cf-nombre-error')).length > 0, 'avisa si falta el nombre');
  await ctx.close();

  // 5. Eventos pasados: el 29/11 desaparece el del 28; el 23/12 ya no queda ninguno y el bloque desaparece
  const ctx2 = await navegador.newContext();
  const p2 = await ctx2.newPage();
  await p2.clock.setFixedTime(new Date('2026-11-29T10:00:00+01:00'));
  await p2.goto(BASE + '/eventos/');
  ok((await p2.$$('.evento-ficha')).length === 3, 'el 29/11 aún sale el del 28 (acaba a las 03:30)');
  await p2.clock.setFixedTime(new Date('2026-11-30T10:00:00+01:00'));
  await p2.goto(BASE + '/eventos/');
  ok((await p2.$$('.evento-ficha')).length === 2, 'el 30/11 ya no sale el del 28/11');
  await p2.clock.setFixedTime(new Date('2027-01-01T03:00:00+01:00'));
  await p2.goto(BASE + '/eventos/');
  ok((await p2.$$('.evento-ficha')).length === 1, 'la madrugada del 1/1 sigue saliendo la Nochevieja');
  await p2.clock.setFixedTime(new Date('2027-01-02T10:00:00+01:00'));
  await p2.goto(BASE + '/');
  ok(await p2.isHidden('#proximos'), 'sin eventos futuros, la home oculta el bloque entero');
  await p2.goto(BASE + '/eventos/');
  ok(await p2.isVisible('[data-sin-eventos]') && await p2.isHidden('.eventos-lista'), 'sin eventos, la página de Eventos no enseña un calendario vacío');
  await ctx2.close();

  await navegador.close();
  servidor.close();
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})();
