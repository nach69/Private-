// Construye la web en la carpeta dist/ a partir de plantillas/, datos/, galeria/, flyers/ y publico/.
// Sin dependencias: solo Node. Uso: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hoyEnMadrid, erroresEvento, eventosFuturos, visibleHasta, fechaCorta, fechaLarga, fechaSinDia, escapar, ordenarCarpetas
} from './lib.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist');
const leerJSON = (ruta) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');

const avisos = [];
const config = leerJSON('datos/config.json');
const marcas = leerJSON('datos/marcas.json');
const eventos = leerJSON('datos/eventos.json');
const idsMarcas = marcas.map((m) => m.id);
const marcaPorId = Object.fromEntries(marcas.map((m) => [m.id, m]));

// ---------- Comprobaciones: un error en los datos para la publicación (mejor que publicar algo roto) ----------
const errores = [];
eventos.forEach((ev, i) => erroresEvento(ev, idsMarcas).forEach((e) => errores.push(`eventos.json, evento ${i + 1}: ${e}`)));
eventos.forEach((ev) => {
  if (ev.flyer && !existsSync(join(RAIZ, 'flyers', ev.flyer))) errores.push(`eventos.json: no existe el flyer flyers/${ev.flyer}`);
});
const nieve = config.nieve || { logoTransvia: null, fotosExtra: [] };
if (nieve.logoTransvia && !existsSync(join(RAIZ, 'publico', nieve.logoTransvia))) errores.push(`config.json: no existe el logo de Transvia publico${nieve.logoTransvia}`);
(nieve.fotosExtra || []).forEach((f) => {
  if (f.src && !existsSync(join(RAIZ, 'publico', f.src))) errores.push(`config.json: no existe la foto de Nieve publico${f.src}`);
});
const fondoNuevo = config.portada.fondoNuevo;
if (fondoNuevo && !existsSync(join(RAIZ, 'publico', fondoNuevo))) errores.push(`config.json: no existe el fondo de portada publico${fondoNuevo}`);
const hayFuenteAcento = existsSync(join(RAIZ, 'publico/fuentes/rl-madena.woff2'));
marcas.forEach((m) => {
  if (m.logo && !existsSync(join(RAIZ, 'publico', m.logo))) errores.push(`marcas.json: no existe el logo publico${m.logo}`);
});
if (errores.length) {
  console.error('\nNo se puede construir la web:\n- ' + errores.join('\n- ') + '\n');
  process.exit(1);
}

// ---------- Marcadores de dato pendiente ----------
const pendiente = (que) => `<mark class="pendiente">PENDIENTE: ${escapar(que)}</mark>`;
const ETIQUETAS = {
  'titular.nombre': 'nombre del titular',
  'titular.nif': 'NIF del titular',
  'titular.direccion': 'dirección del titular',
  telefono: 'teléfono'
};

// ---------- Bloques generados ----------
const hoy = hoyEnMadrid();
const futuros = eventosFuturos(eventos, hoy);

function flyerEvento(ev, marca, perezosa) {
  if (ev.flyer) {
    const alt = ev.censurado ? `Flyer del próximo evento de ${marca.nombre}` : `Flyer de ${ev.titulo || marca.nombre}`;
    return `<img src="/flyers/${escapar(ev.flyer)}" alt="${escapar(alt)}" width="720" height="1280"${perezosa ? ' loading="lazy"' : ''}>`;
  }
  // Sin flyer todavía: cartel provisional con la marca y la fecha.
  return `<div class="flyer-provisional${ev.censurado ? ' flyer-provisional--censurado' : ''}" role="img" aria-label="${escapar(marca.nombre)}, ${escapar(fechaLarga(ev.fecha))}">
      <span class="flyer-provisional__marca">${escapar(marca.nombre)}</span>
      ${ev.censurado ? '<span class="censura" aria-hidden="true">██████</span><span class="censura censura--corta" aria-hidden="true">████</span>' : ''}
      <span class="flyer-provisional__fecha">${escapar(fechaCorta(ev.fecha))}</span>
    </div>`;
}

function tituloEvento(ev, marca) {
  if (ev.censurado) return `<span class="censura" aria-label="Por desvelar">█████████</span>`;
  return ev.titulo ? escapar(ev.titulo) : escapar(marca.nombre);
}

function botonEntradas(ev, clase = '') {
  if (ev.entradas) return `<a class="btn ${clase}" href="${escapar(ev.entradas)}" target="_blank" rel="noopener">Entradas</a>`;
  return `<span class="btn btn--apagado ${clase}" aria-disabled="true">Entradas pronto</span>`;
}

function tarjetaCarrusel(ev, i) {
  const marca = marcaPorId[ev.marca];
  const flyer = flyerEvento(ev, marca, i > 1);
  // Toda la tarjeta lleva a las entradas (Fourvenues). Sin enlace todavía: href="#" y data-fourvenues vacío.
  const url = ev.entradas || '';
  const enlace = url
    ? `href="${escapar(url)}" target="_blank" rel="noopener noreferrer"`
    : 'href="#"';
  return `<li class="evento" data-fecha="${visibleHasta(ev)}">
    <a class="evento__enlace" ${enlace} data-fourvenues="${escapar(url)}" aria-label="Entradas: ${escapar(marca.nombre)}, ${escapar(fechaLarga(ev.fecha))}">
      <span class="evento__flyer">${flyer}</span>
      <span class="evento__fecha"><time datetime="${ev.fecha}">${escapar(fechaSinDia(ev.fecha))}</time></span>
      <span class="evento__marca">${escapar(marca.nombre)}</span>
    </a>
  </li>`;
}

function tarjetaLista(ev, i) {
  const marca = marcaPorId[ev.marca];
  const sitio = ev.lugar ? escapar(ev.lugar) : (ev.censurado ? 'Por desvelar' : pendiente('lugar'));
  const hora = ev.hora
    ? escapar(ev.hora) + (ev.horaFin ? '–' + escapar(ev.horaFin) : '') + ' h'
    : (ev.censurado ? 'Por desvelar' : pendiente('hora'));
  return `<li class="evento-ficha" data-fecha="${visibleHasta(ev)}">
    <div class="evento-ficha__flyer">${flyerEvento(ev, marca, i > 1)}</div>
    <div class="evento-ficha__datos">
      <p class="meta-label">${escapar(marca.nombre)}</p>
      <h2 class="evento-ficha__titulo">${tituloEvento(ev, marca)}</h2>
      <dl class="evento-ficha__lista">
        <div><dt>Fecha</dt><dd><time datetime="${ev.fecha}">${escapar(fechaLarga(ev.fecha))}</time></dd></div>
        <div><dt>Hora</dt><dd>${hora}</dd></div>
        <div><dt>Sitio</dt><dd>${sitio}</dd></div>
      </dl>
      ${botonEntradas(ev)}
    </div>
  </li>`;
}

function franjaMarcas() {
  // Solo las marcas con "enFranja": true en marcas.json
  return marcas.filter((m) => m.enFranja !== false).map((m) => {
    const dentro = m.logo
      ? `<img src="${escapar(m.logo)}" alt="${escapar(m.nombre)}" width="150" height="150" loading="lazy">`
      : `<span class="marca-cuadro__nombre">${escapar(m.nombre)}</span>`;
    if (m.instagram) {
      return `<li><a class="marca-cuadro" href="${escapar(m.instagram)}" target="_blank" rel="noopener" aria-label="${escapar(m.nombre)} en Instagram">${dentro}</a></li>`;
    }
    return `<li><span class="marca-cuadro marca-cuadro--sin-enlace" title="Falta el Instagram de ${escapar(m.nombre)}">${dentro}</span></li>`;
  }).join('\n');
}

// ---------- Galería de Vosotros ----------
const EXT_FOTO = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const MAX_PESO = 700 * 1024;

function fotosGaleria() {
  const base = join(RAIZ, 'galeria');
  if (!existsSync(base)) return [];
  const grupos = [];
  for (const id of readdirSync(base)) {
    const dirMarca = join(base, id);
    if (!statSync(dirMarca).isDirectory()) continue;
    const marca = marcaPorId[id];
    if (!marca) { avisos.push(`galeria/${id}: no hay ninguna marca con ese id en marcas.json; se ignora.`); continue; }
    if (marca.menores) { avisos.push(`galeria/${id}: ${marca.nombre} tiene público menor de edad; sus fotos NO se publican.`); continue; }
    for (const carpeta of readdirSync(dirMarca)) {
      const dir = join(dirMarca, carpeta);
      if (statSync(dir).isDirectory()) grupos.push({ marca, carpeta, dir });
    }
  }
  const orden = ordenarCarpetas([...new Set(grupos.map((g) => g.carpeta))]);
  grupos.sort((a, b) => orden.indexOf(a.carpeta) - orden.indexOf(b.carpeta) || a.marca.id.localeCompare(b.marca.id));

  const fotos = [];
  for (const g of grupos) {
    const textos = existsSync(join(g.dir, 'textos.json')) ? JSON.parse(readFileSync(join(g.dir, 'textos.json'), 'utf8')) : {};
    for (const archivo of readdirSync(g.dir).sort()) {
      if (!EXT_FOTO.has(extname(archivo).toLowerCase())) continue;
      const peso = statSync(join(g.dir, archivo)).size;
      if (peso > MAX_PESO) avisos.push(`galeria/${g.marca.id}/${g.carpeta}/${archivo} pesa ${Math.round(peso / 1024)} KB: conviene reducirla (máx. ~700 KB).`);
      fotos.push({
        src: `/galeria/${g.marca.id}/${encodeURIComponent(g.carpeta)}/${encodeURIComponent(archivo)}`,
        alt: textos[archivo] || `Asistentes en un evento de ${g.marca.nombre}`,
        marca: g.marca
      });
    }
  }
  return fotos;
}

// Para que la última fila de la galería nunca quede a medias: con 2, 3 o 4 columnas,
// las primeras fotos que hagan falta ocupan dos huecos (clases ancha-2, ancha-3, ancha-4).
function clasesAnchas(i, total) {
  return [2, 3, 4].filter((cols) => i < (cols - (total % cols)) % cols).map((cols) => `ancha-${cols}`);
}

function galeriaHTML(fotos) {
  if (!fotos.length) return '<p class="galeria__vacia">Pronto subiremos las primeras fotos.</p>';
  return '<ul class="galeria" role="list">' + fotos.map((f, i) => {
    const clases = clasesAnchas(i, fotos.length);
    const img = `<img src="${f.src}" alt="${escapar(f.alt)}" loading="lazy">`;
    const pie = `<span class="galeria__marca">${escapar(f.marca.nombre)}</span>`;
    const li = clases.length ? `<li class="${clases.join(' ')}">` : '<li>';
    return f.marca.instagram
      ? `${li}<a href="${escapar(f.marca.instagram)}" target="_blank" rel="noopener" aria-label="${escapar(f.alt)}. Ver ${escapar(f.marca.nombre)} en Instagram">${img}${pie}</a></li>`
      : `${li}<div>${img}${pie}</div></li>`;
  }).join('\n') + '</ul>';
}

// ---------- Motor de plantillas mínimo ----------
// {{> parcial}}  incluye plantillas/parciales/parcial.html
// {{{bloque}}}   inserta HTML generado tal cual
// {{clave}}      inserta un dato de config.json escapado (null = marcador PENDIENTE)
function obtener(obj, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function rellenar(plantilla, ctx, bloques) {
  let html = plantilla;
  for (let i = 0; i < 5 && html.includes('{{>'); i++) {
    html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => leer(`plantillas/parciales/${n}.html`));
  }
  html = html.replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_, n) => {
    if (!(n in bloques)) throw new Error(`Bloque desconocido {{{${n}}}}`);
    return bloques[n];
  });
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, ruta) => {
    const v = obtener(ctx, ruta);
    if (v === undefined) throw new Error(`Dato desconocido {{${ruta}}}`);
    if (v === null || v === '') return pendiente(ETIQUETAS[ruta] || ruta);
    return escapar(v);
  });
}

// ---------- Páginas ----------
const PAGINAS = [
  { plantilla: 'inicio.html', salida: 'index.html', ruta: '/', titulo: null, descripcion: config.descripcion, clase: 'con-portada' },
  { plantilla: 'eventos.html', salida: 'eventos/index.html', ruta: '/eventos/', titulo: 'Próximos eventos', descripcion: `Los próximos planes de ${config.nombre} en Valencia: fechas, sitios y entradas.` },
  { plantilla: 'vosotros.html', salida: 'vosotros/index.html', ruta: '/vosotros/', titulo: 'Vosotros', descripcion: `Fotos de la gente que hace que los planes de ${config.nombre} se repitan.` },
  { plantilla: 'contacto.html', salida: 'contacto/index.html', ruta: '/contacto/', titulo: 'Contacto', descripcion: `Escríbenos si eres una marca, un local o un patrocinador, o si vienes a nuestros planes.` },
  { plantilla: 'legal-aviso.html', salida: 'aviso-legal/index.html', ruta: '/aviso-legal/', titulo: 'Aviso legal', descripcion: `Aviso legal de la web de ${config.nombre}.`, noindex: true },
  { plantilla: 'legal-privacidad.html', salida: 'privacidad/index.html', ruta: '/privacidad/', titulo: 'Política de privacidad', descripcion: `Cómo trata ${config.nombre} tus datos personales.`, noindex: true },
  { plantilla: 'legal-cookies.html', salida: 'cookies/index.html', ruta: '/cookies/', titulo: 'Política de cookies', descripcion: `Qué guarda la web de ${config.nombre} en tu navegador.`, noindex: true },
  { plantilla: '404.html', salida: '404.html', ruta: '/404', titulo: 'Página no encontrada', descripcion: config.descripcion, noindex: true }
];

const fotos = fotosGaleria();
const bloquesComunes = {
  eventosCarrusel: futuros.map(tarjetaCarrusel).join('\n'),
  eventosLista: futuros.map(tarjetaLista).join('\n'),
  ocultarSiNoHayEventos: futuros.length ? '' : ' hidden',
  mostrarSiNoHayEventos: futuros.length ? ' hidden' : '',
  franjaMarcas: franjaMarcas(),
  galeria: galeriaHTML(fotos),
  // Vídeo de fondo de la portada (móvil y ordenador).
  portadaVideo: config.portada.videoMp4
    ? `<video class="portada__video" autoplay muted loop playsinline preload="metadata" poster="${escapar(config.portada.videoPoster || config.portada.imagenMovil)}" aria-hidden="true">
        ${config.portada.videoWebm ? `<source src="${escapar(config.portada.videoWebm)}" type="video/webm">` : ''}
        <source src="${escapar(config.portada.videoMp4)}" type="video/mp4">
      </video>`
    : '',
  logoTransvia: nieve.logoTransvia
    ? `<img class="snow__partner-logo" src="${escapar(nieve.logoTransvia)}" alt="Transvia Xperience" loading="lazy">`
    : '<span class="hueco hueco--logo">PENDIENTE: logo de Transvia</span>',
  fotosNieveExtra: (nieve.fotosExtra || []).map((f, i) => f.src
    ? `          <li><img src="${escapar(f.src)}" alt="${escapar(f.alt || 'Viaje a la nieve con Veleta')}" width="900" height="675" loading="lazy"></li>`
    : '').filter(Boolean).join('\n'),
  fondoPortadaMovil: escapar(fondoNuevo || config.portada.imagenMovil),
  fondoPortadaGrande: escapar(fondoNuevo || config.portada.imagenGrande),
  avisoFondo: fondoNuevo ? '' : '<p class="portada__aviso"><mark class="pendiente">PENDIENTE: nueva imagen de fondo</mark></p>',
  avisoFuente: hayFuenteAcento ? '' : '<p class="marquee__aviso"><mark class="pendiente">PENDIENTE: archivo de la tipografía RL Madena</mark></p>',
  anio: String(new Date().getFullYear())
};

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(RAIZ, 'publico'), DIST, { recursive: true });
if (existsSync(join(RAIZ, 'flyers'))) cpSync(join(RAIZ, 'flyers'), join(DIST, 'flyers'), { recursive: true, filter: (s) => !s.endsWith('.gitkeep') });
for (const f of fotos) {
  const origen = join(RAIZ, decodeURIComponent(f.src));
  const destino = join(DIST, decodeURIComponent(f.src));
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(origen, destino);
}

const base = leer('plantillas/parciales/base.html');
for (const p of PAGINAS) {
  const tituloCompleto = p.titulo ? `${p.titulo} · ${config.nombre}` : `${config.nombre} · Valencia`;
  const bloques = {
    ...bloquesComunes,
    contenido: rellenar(leer(`plantillas/${p.plantilla}`), config, bloquesComunes),
    tituloPagina: escapar(tituloCompleto),
    descripcionPagina: escapar(p.descripcion),
    urlPagina: escapar(config.dominio + (p.ruta === '/404' ? '/' : p.ruta)),
    claseCuerpo: p.clase || 'sin-portada',
    robots: p.noindex ? '<meta name="robots" content="noindex">' : '',
    navActual: p.ruta
  };
  let html = rellenar(base, config, bloques);
  // Marca el enlace del menú de la página actual
  html = html.replace(new RegExp(`(<a[^>]*href="${p.ruta.replace(/\//g, '\\/')}")`, 'g'), '$1 aria-current="page"');
  const destino = join(DIST, p.salida);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html);
}

// sitemap.xml y robots.txt
const indexables = PAGINAS.filter((p) => !p.noindex);
writeFileSync(join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  indexables.map((p) => `  <url><loc>${config.dominio}${p.ruta}</loc></url>`).join('\n') + '\n</urlset>\n');
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.dominio}/sitemap.xml\n`);

console.log(`Web construida en dist/ · hoy ${hoy} · ${futuros.length} evento(s) futuro(s) de ${eventos.length} · ${fotos.length} foto(s) en Vosotros`);
if (avisos.length) console.warn('Avisos:\n- ' + avisos.join('\n- '));
