// Worker de Cloudflare: sirve la web (carpeta dist/), recibe los formularios en /api/contacto
// y deja descargar la lista de la newsletter en /api/newsletter.csv (con clave).
// Las páginas, fotos y estilos los sirve Cloudflare directamente; este código solo se ejecuta para /api/*.
import { onRequestPost } from './contacto.js';
import { exportarCSV } from './newsletter.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contacto') {
      if (request.method === 'POST') return onRequestPost({ request, env });
      return new Response('Método no permitido', { status: 405, headers: { Allow: 'POST' } });
    }
    if (url.pathname === '/api/newsletter.csv' && request.method === 'GET') return exportarCSV(request, env);
    if (url.pathname.startsWith('/api/')) return new Response('No encontrado', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
