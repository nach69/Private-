# Web de Grupo Sobremesa — memoria del proyecto

Léelo antes de trabajar. Lo mantiene Claude; actualízalo cuando cambie algo.

- Cliente: Nacho (socio de Grupo Sobremesa). Hablarle en español, sin jerga, pasos numerados. Consultarle antes de cambios grandes. Le gusta ver opciones. Tono de los textos: natural y cercano, nada de lenguaje de pitch.
- Web estática, generador propio sin dependencias (`scripts/build.mjs`) → `dist/`. Cloudflare **Worker** con Static Assets (plan gratuito; Nacho lo creó como Worker, no Pages), nombre `private`, conectado a GitHub, publica desde `main`. Prueba: https://private.super-unit-ca4a.workers.dev. Config en `wrangler.jsonc` (el `name` debe coincidir con el del panel). **No usar Netlify** para esta web. No mezclar con la app de tareas (repo nach69/Sobremesa) ni con la futura web de fidelización de Veleta.
- **No inventar datos** (fechas, sitios, cuentas, nombres): lo que falta va a `null` y la web lo marca como PENDIENTE. Eventos: solo los que confirme Nacho (flyer o enlace de entradas).
- Nombre de la marca: solo en `datos/config.json`.
- Menores: Tutto Passa (generación 2009) → nunca fotos suyas en Vosotros (la build las ignora).
- Nada de terceros antes de aceptar cookies; sin analítica.
- **DNS**: el correo de info@ está en Google Workspace. Guardar todos los registros antes de tocar nada y no tocar el DNS sin el visto bueno de Nacho y del informático.
- Formulario: `src/worker.js` → `src/contacto.js` + `lib/formulario.mjs`, envío por Resend (pendiente de validar por el informático).
- Probar antes de subir: `npm test`, `npm run test:navegador` y `npx wrangler deploy --dry-run`. El entorno «Web Sobremesa» permite abrir private.super-unit-ca4a.workers.dev y developers.cloudflare.com (añadidos el 19/11 con permiso de Nacho) para comprobar la web publicada.
- Base visual: la web base de Manu (blanco/negro/grises; Helvetica Neue Bold, Instrument Serif cursiva, Archivo). La marca «Sobremesa®» es suya (registrada por el grupo).
