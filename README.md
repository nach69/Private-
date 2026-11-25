# Web de Grupo Sobremesa

Web pública de Grupo Sobremesa (gruposobremesa.com). Se publica sola en **Cloudflare** (un *Worker* llamado `private`) cada vez que se guarda un cambio en la rama `main` de este repositorio. Dirección de prueba: https://private.super-unit-ca4a.workers.dev

No tiene base de datos ni panel: todo lo que cambia (eventos, marcas, fotos) está en archivos de este repositorio.

---

## Cómo añadir un evento

1. Abre el archivo **`datos/eventos.json`** en GitHub y pulsa el lápiz (✏️) para editarlo.
2. Copia un evento que ya exista (desde `{` hasta `}`), pégalo debajo con una coma entre medias y cambia los datos:

   ```json
   {
     "marca": "veleta",
     "titulo": "Feria Veleta",
     "fecha": "2027-03-14",
     "hora": "18:00",
     "horaFin": "23:00",
     "lugar": "Veles e Vents, Valencia",
     "flyer": "2027-03-14-veleta.jpg",
     "entradas": "https://enlace-de-las-entradas"
   }
   ```

   - **marca**: una de estas, en minúsculas: `veleta`, `solea`, `tutto-passa`, `basto`, `yolo`.
   - **fecha**: siempre año-mes-día (`2027-03-14`).
   - **hora** y **horaFin**: con dos puntos (`18:00`). `horaFin` es opcional. Si el evento acaba de madrugada (por ejemplo `20:00` a `03:30`) o empieza de madrugada (`00:30`, como una Nochevieja), sigue saliendo en la web hasta el día siguiente.
   - Si todavía no sabes un dato, pon `null` (sin comillas): en la web saldrá como «PENDIENTE».
   - Si aún no hay enlace de entradas, pon `"entradas": null` y saldrá «Entradas pronto».
   - Para un evento que todavía es secreto, añade `"censurado": true`: salen la marca y la fecha, y el resto tapado.
3. Sube el flyer a la carpeta **`flyers/`** (botón *Add file → Upload files*) con el mismo nombre que has puesto en `"flyer"`. En vertical, formato historia de Instagram (9:16), y de menos de 500 KB.
4. Pulsa **Commit changes**. En un par de minutos está publicado.

No hace falta borrar los eventos pasados: la web los esconde sola al día siguiente. Si no queda ninguno, el bloque de «Próximos eventos» desaparece en vez de quedarse vacío.

Si te equivocas en el formato (una fecha mal escrita, una marca que no existe…), Cloudflare **no publica** el cambio y la web sigue como estaba. En Cloudflare, dentro del Worker, en *Deployments* / *Builds*, verás el error explicado en español.

## Cómo añadir fotos a «Vosotros»

1. Entra en la carpeta **`galeria/`** y luego en la de la marca (`veleta`, `solea`…).
2. Crea una carpeta con la fecha del evento delante, por ejemplo `2026-11-28-basto` (en GitHub: *Add file → Upload files* y escribe `2026-11-28-basto/` delante del nombre del archivo).
3. Sube las fotos ahí. Mejor de menos de 700 KB cada una.
4. *Commit changes*.

Cada foto enlaza sola al Instagram de su marca. Las carpetas más recientes salen primero.

**Importante:** no se publican fotos de menores ni de eventos con menores sin la autorización de sus tutores. Las fotos que se pongan en `galeria/tutto-passa/` **no se publican nunca** (la web las ignora a propósito).

**Si alguien pide que quitemos una foto:** bórrala de su carpeta en GitHub (abre la foto → los tres puntos → *Delete file* → *Commit changes*).

## Cómo cambiar otras cosas

| Qué | Dónde |
|---|---|
| Nombre de la marca, email, Instagram, cifras, vídeo de portada, datos legales del titular | `datos/config.json` |
| Logos e Instagram de las marcas | `datos/marcas.json` (y el logo, en `publico/logos/marcas/`) |
| Textos de la home y del resto de páginas | `plantillas/*.html` |
| Colores y tipografías | `publico/css/estilos.css` (arriba del todo) |

El nombre «Grupo Sobremesa» se cambia **solo** en `datos/config.json` (`nombre` y `nombreCorto`). El logo es una imagen aparte (`publico/logos/`).

---

## Parte técnica

- Generador propio sin dependencias: `scripts/build.mjs` junta `plantillas/` + `datos/` + `galeria/` + `flyers/` + `publico/` en `dist/`.
- Worker de Cloudflare: `src/worker.js` sirve `dist/` y atiende `/api/contacto` (`src/contacto.js`, lógica en `lib/formulario.mjs`). Configuración en `wrangler.jsonc`.
- Formulario de contacto: envía a info@ con la API de **Resend**.
- Newsletter («Únete a la sobremesa», `plantillas/parciales/unete.html`, en Inicio, Eventos, Vosotros y Contacto): cada alta se **guarda en Cloudflare D1** (base de datos `sobremesa-newsletter`, en la UE; `src/newsletter.js`). Cloudflare crea la base de datos sola en la primera publicación y el Worker crea la tabla en la primera alta. Si Resend está configurado, además llega un aviso a info@. Sin casilla: escribir el email y pulsar «Me apunto» es el consentimiento; se guarda fecha, IP, página y el texto que había a la vista.
- Descargar la lista: `https://gruposobremesa.com/api/newsletter.csv?clave=…` (CSV con «;», se abre con Excel). La clave es el secreto `NEWSLETTER_CLAVE`; sin él, la descarga está apagada. También se ve en Cloudflare → Storage & Databases → D1 → `sobremesa-newsletter` → Console.
- Antispam de los formularios: campo trampa, tiempo mínimo de rellenado, comprobación de origen y límite de enlaces.
- Sin cookies ni nada de terceros. El aviso de cookies guarda la elección en el navegador (`sm_cookies`); si algún día se incrusta algo de fuera, se marca con `data-consent-src` y solo se carga tras «Aceptar».
- Cabeceras de seguridad y caché en `publico/_headers`. Fotos, logos, flyers y vídeos se revisan en cada visita (`must-revalidate`): si se cambia un archivo aunque se llame igual, se ve al momento tras publicar. La dirección de prueba `workers.dev` lleva `noindex`.
- Publicar = subir a `main`. Cloudflare construye y cambia a la versión nueva de golpe, sin cortes; si la construcción falla, sigue la versión anterior.

### Probar en local

```bash
npm test                 # construye y pasa las pruebas de lógica y del formulario
npm run test:navegador   # pruebas en Chromium (necesita Playwright)
npm run dev              # construye y sirve la web en http://localhost:8080
npx wrangler dev         # igual, pero imitando Cloudflare (incluye el formulario)
```

### Configuración de Cloudflare (Worker conectado a GitHub)

- *Build command*: `npm run build` · *Deploy command*: `npx wrangler deploy` · rama `main`.
- El nombre del Worker en el panel tiene que ser el mismo que `name` en `wrangler.jsonc` (`private`).
- Variables (el Worker → Settings → Variables and Secrets):
  - `RESEND_API_KEY` (como **secreto**)
  - `EMAIL_FROM`, por ejemplo `Web Grupo Sobremesa <web@gruposobremesa.com>`
  - `EMAIL_TO` (opcional; por defecto `info@gruposobremesa.com`)
  - `NEWSLETTER_CLAVE` (como **secreto**): clave para descargar la lista de la newsletter

### Regla del DNS

El correo de info@gruposobremesa.com está en **Google Workspace**. Antes de tocar cualquier registro del dominio, se copian y guardan todos los que hay (MX, SPF, DKIM, DMARC). Para que Resend envíe en nombre del dominio solo hay que **añadir** registros (DKIM y los de un subdominio de envío); **no se toca ni se borra** nada de Google.
