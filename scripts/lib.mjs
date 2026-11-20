// Funciones puras que usa la construcción de la web (y que prueban los tests).

/** Fecha de hoy en Valencia (Europe/Madrid) como AAAA-MM-DD. */
export function hoyEnMadrid(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(ahora);
  const v = (t) => partes.find((p) => p.type === t).value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Comprueba que un evento tiene lo mínimo; devuelve la lista de problemas. */
export function erroresEvento(ev, idsMarcas) {
  const errores = [];
  if (!ev || typeof ev !== 'object') return ['no es un evento'];
  if (!idsMarcas.includes(ev.marca)) errores.push(`marca desconocida «${ev.marca}» (usa una de: ${idsMarcas.join(', ')})`);
  if (!FECHA_RE.test(ev.fecha || '') || Number.isNaN(Date.parse(ev.fecha))) errores.push(`fecha «${ev.fecha}» no válida (formato AAAA-MM-DD)`);
  if (ev.hora && !/^\d{2}:\d{2}$/.test(ev.hora)) errores.push(`hora «${ev.hora}» no válida (formato 18:00)`);
  if (ev.horaFin && !/^\d{2}:\d{2}$/.test(ev.horaFin)) errores.push(`horaFin «${ev.horaFin}» no válida (formato 03:30)`);
  if (ev.entradas && !/^https:\/\//.test(ev.entradas)) errores.push('el enlace de entradas debe empezar por https://');
  return errores;
}

/** Día siguiente a una fecha AAAA-MM-DD. */
function diaSiguiente(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Último día en que el evento se muestra. Normalmente su propio día; si acaba de madrugada
 * (horaFin menor que hora) o empieza de madrugada (antes de las 06:00, como una Nochevieja
 * a las 00:30), sigue visible también el día siguiente.
 */
export function visibleHasta(ev) {
  const cruzaMedianoche = (ev.hora && ev.horaFin && ev.horaFin < ev.hora) || (ev.hora && ev.hora < '06:00');
  return cruzaMedianoche ? diaSiguiente(ev.fecha) : ev.fecha;
}

/** Eventos que aún no han terminado, ordenados por fecha y hora. */
export function eventosFuturos(eventos, hoy) {
  return eventos
    .filter((ev) => visibleHasta(ev) >= hoy)
    .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function partesFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return { a, m, d, dia };
}

/** «sáb 28 nov» */
export function fechaCorta(iso) {
  const { m, d, dia } = partesFecha(iso);
  return `${DIAS[dia]} ${d} ${MESES[m - 1]}`;
}

/** «sábado 28 de noviembre» */
export function fechaLarga(iso) {
  const { m, d, dia } = partesFecha(iso);
  return `${DIAS_LARGOS[dia]} ${d} de ${MESES_LARGOS[m - 1]}`;
}

export function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Orden de las carpetas de la galería: las fechadas (AAAA-MM-DD…) de más nueva a más vieja; el resto, al final. */
export function ordenarCarpetas(nombres) {
  const fechadas = nombres.filter((n) => /^\d{4}-\d{2}-\d{2}/.test(n)).sort().reverse();
  const otras = nombres.filter((n) => !/^\d{4}-\d{2}-\d{2}/.test(n)).sort();
  return [...fechadas, ...otras];
}
