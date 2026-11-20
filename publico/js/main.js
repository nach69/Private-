/* =========================================================
   Grupo Sobremesa · interacciones
   JavaScript sin dependencias. Nada de terceros.
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Almacenamiento local a prueba de navegadores que lo bloquean ---------- */
  var almacen = {
    leer: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    guardar: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- Eventos: ocultar los que ya han pasado (hora de Valencia) ---------- */
  function hoyEnMadrid() {
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      var v = function (t) { return p.filter(function (x) { return x.type === t; })[0].value; };
      return v('year') + '-' + v('month') + '-' + v('day');
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  var hoy = hoyEnMadrid();
  document.querySelectorAll('[data-fecha]').forEach(function (el) {
    if (el.getAttribute('data-fecha') < hoy) el.remove();
  });
  document.querySelectorAll('[data-lista-eventos]').forEach(function (lista) {
    if (lista.children.length) return;
    var bloque = lista.closest('[data-bloque-eventos]') || lista;
    bloque.hidden = true;
    var vacio = document.querySelector('[data-sin-eventos]');
    if (vacio) vacio.hidden = false;
  });

  /* ---------- Cabecera: fondo sólido al hacer scroll (solo en la home) ---------- */
  var header = document.querySelector('.site-header');
  var portada = document.querySelector('.portada');
  function updateHeader() {
    if (!portada) { header.classList.add('is-solid'); return; }
    var limit = portada.offsetHeight - header.offsetHeight - 20;
    header.classList.toggle('is-solid', window.scrollY > limit);
  }
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  window.addEventListener('resize', updateHeader);

  /* ---------- Menú móvil ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');
  var toggleLabel = toggle.querySelector('.menu-toggle__label');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Cerrar' : 'Menú';
    menu.hidden = !open;
    menu.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    document.body.classList.toggle('no-scroll', open);
  }
  toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 960px)').addEventListener('change', function (mq) { if (mq.matches) setMenu(false); });

  /* ---------- Aparición suave ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Carrusel de flyers: flechas en ordenador ---------- */
  var carrusel = document.querySelector('.carrusel');
  document.querySelectorAll('[data-carrusel]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!carrusel || !carrusel.firstElementChild) return;
      var paso = carrusel.firstElementChild.getBoundingClientRect().width + 18;
      carrusel.scrollBy({ left: paso * Number(btn.getAttribute('data-carrusel')), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* =========================================================
     MOVIMIENTO (prueba 20/11). Todo mueve solo posición, tamaño y opacidad (60 fps en móvil).
     Con «reducir movimiento» no se ejecuta nada de esto y la página se ve quieta.
     Cada bloque se puede borrar por separado si no gusta.
     ========================================================= */
  if (!reduceMotion) {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    window.addEventListener('resize', function () { vh = window.innerHeight || document.documentElement.clientHeight; pedirFrame(); });
    var limitar = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
    // Progreso de un elemento al cruzar la pantalla: 0 cuando asoma por abajo, 1 cuando llega a «hasta» (fracción de pantalla).
    var progreso = function (r, hasta) { return limitar((vh - r.top) / (vh * (1 - hasta))); };

    // [MOV-1] Portada: al bajar, las dos mitades del titular se separan, el logo se encoge y el vídeo va más lento y se oscurece
    var portadaMov = document.querySelector('.portada');

    // [MOV-3] Nieve: el título se rellena, los logos se juntan, las fotos se mueven a distinto ritmo
    var nieveTitulo = document.querySelector('.snow__title');
    var nieveLockup = document.querySelector('.snow__lockup');
    var nieveVideo = document.querySelector('.snow__video');
    var nieveFoto = document.querySelector('.snow__foto-movil');
    if (nieveTitulo) document.documentElement.classList.add('mov-nieve');

    var pendiente = false;
    function pedirFrame() { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } }
    function actualizar() {
      pendiente = false;
      // Primero se leen todas las medidas y después se escribe (evita recalcular la página varias veces)
      var rp = portadaMov && portadaMov.getBoundingClientRect();
      var rt = nieveTitulo && nieveTitulo.getBoundingClientRect();
      var rl = nieveLockup && nieveLockup.getBoundingClientRect();
      var rv = nieveVideo && nieveVideo.getBoundingClientRect();
      var rf = nieveFoto && nieveFoto.getBoundingClientRect();

      if (rp && rp.bottom > 0) portadaMov.style.setProperty('--p', limitar(-rp.top / rp.height).toFixed(3));
      if (rt && rt.top < vh && rt.bottom > 0) nieveTitulo.style.setProperty('--relleno', (progreso(rt, 0.35) * 100).toFixed(1) + '%');
      if (rl && rl.top < vh && rl.bottom > 0) nieveLockup.style.setProperty('--q', progreso(rl, 0.3).toFixed(3));
      if (rv && rv.top < vh && rv.bottom > 0) nieveVideo.style.setProperty('--pv', ((rv.top + rv.height / 2) / vh - 0.5).toFixed(3));
      if (rf && rf.top < vh && rf.bottom > 0) nieveFoto.style.setProperty('--pf', limitar((vh - rf.top) / (vh + rf.height)).toFixed(3));
    }
    window.addEventListener('scroll', pedirFrame, { passive: true });
    pedirFrame();

    // [MOV-2] Carrusel: el flyer del centro se ve entero y los laterales más pequeños; la imagen de dentro se desplaza al deslizar
    var carruselMov = document.querySelector('[data-carrusel-scroll]');
    if (carruselMov) {
      carruselMov.classList.add('carrusel--foco');
      var pendienteC = false;
      var enfocar = function () {
        pendienteC = false;
        var rc = carruselMov.getBoundingClientRect();
        var centro = rc.left + rc.width / 2;
        var tarjetas = carruselMov.querySelectorAll('.evento');
        var medidas = [];
        tarjetas.forEach(function (t) { medidas.push(t.getBoundingClientRect()); });
        tarjetas.forEach(function (t, i) {
          var m = medidas[i];
          var dx = ((m.left + m.width / 2) - centro) / m.width; // 0 en el centro, ±1 una tarjeta al lado
          var d = Math.min(1, Math.abs(dx));
          t.style.setProperty('--d', d.toFixed(3));
          t.style.setProperty('--dx', Math.max(-1, Math.min(1, dx)).toFixed(3));
        });
      };
      carruselMov.addEventListener('scroll', function () { if (!pendienteC) { pendienteC = true; requestAnimationFrame(enfocar); } }, { passive: true });
      window.addEventListener('resize', enfocar);
      enfocar();

      // Pequeño empujón la primera vez que aparece, para que se entienda que se desliza
      if ('IntersectionObserver' in window && carruselMov.scrollWidth > carruselMov.clientWidth + 10) {
        var ioEmpujon = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          ioEmpujon.disconnect();
          var tocado = false;
          carruselMov.addEventListener('pointerdown', function () { tocado = true; }, { once: true, passive: true });
          setTimeout(function () {
            if (tocado) return;
            var inicioX = carruselMov.scrollLeft;
            carruselMov.classList.add('carrusel--scroll'); // sin «imán» mientras dura el empujón
            carruselMov.scrollTo({ left: inicioX + 70, behavior: 'smooth' });
            setTimeout(function () {
              if (!tocado) carruselMov.scrollTo({ left: inicioX, behavior: 'smooth' });
              setTimeout(function () { carruselMov.classList.remove('carrusel--scroll'); }, 700);
            }, 650);
          }, 400);
        }, { threshold: 0.6 });
        ioEmpujon.observe(carruselMov);
      }
    }
  }

  /* Tarjetas aún sin enlace de entradas (href="#"): no saltan arriba de la página */
  document.querySelectorAll('.evento__enlace[href="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ---------- Vídeos: solo se reproducen a la vista y nunca solos si se pide «reducir movimiento» ---------- */
  function controlarVideo(video, soloMovil) {
    if (!video) return;
    // El vídeo de la portada es solo para el móvil; en ordenador se queda la foto.
    if (soloMovil && window.matchMedia('(min-width: 768px)').matches) { video.remove(); return; }
    // La portada se reproduce siempre (decisión de Nacho, 20/11), también con «reducir movimiento».
    if (reduceMotion && !soloMovil) { video.removeAttribute('autoplay'); video.pause(); return; }
    if (!('IntersectionObserver' in window)) { video.play().catch(function () {}); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) video.play().catch(function () {});
        else video.pause();
      });
    }, { threshold: 0.2 }).observe(video);
  }
  controlarVideo(document.querySelector('.portada__video'), true);
  controlarVideo(document.querySelector('.snow__player'), false);

  /* ---------- Cifras: cuentan desde 0 hasta el valor al entrar en pantalla ----------
     Es un cambio de número, no un movimiento: también se hace con «reducir movimiento», pero más rápido. */
  var cifras = document.querySelectorAll('[data-contar]');
  if (cifras.length && 'IntersectionObserver' in window) {
    var formatear = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var contar = function (el) {
      var fin = Number(String(el.getAttribute('data-contar')).replace(/\D/g, '')) || 0;
      var duracion = reduceMotion ? 500 : 1800;
      var inicio = null;
      function paso(t) {
        if (inicio === null) inicio = t;
        var p = Math.min(1, (t - inicio) / duracion);
        var suave = 1 - Math.pow(1 - p, 3);
        el.textContent = formatear(Math.round(fin * suave));
        if (p < 1) requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
    };
    var ioCifras = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // Empieza justo cuando termina de aparecer la cifra
        if (entry.isIntersecting) { var el = entry.target; setTimeout(function () { contar(el); }, 250); ioCifras.unobserve(el); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });
    cifras.forEach(function (el) {
      el.setAttribute('aria-label', el.textContent);
      el.textContent = '0';
      ioCifras.observe(el);
    });
  }

  /* ---------- Aviso de cookies (Aceptar / Denegar) ----------
     Hoy no se carga nada de terceros. Si algún día se añade, se marca así en el HTML:
       <iframe data-consent-src="https://…"></iframe>
     y solo se carga tras «Aceptar». */
  var aviso = document.getElementById('aviso-cookies');
  var CLAVE = 'sm_cookies';
  var DOCE_MESES = 365 * 24 * 3600 * 1000;
  function eleccion() {
    try {
      var g = JSON.parse(almacen.leer(CLAVE) || 'null');
      if (g && Date.now() - g.fecha < DOCE_MESES) return g.valor;
    } catch (e) { /* dato corrupto: se vuelve a preguntar */ }
    return null;
  }
  function cargarTerceros() {
    document.querySelectorAll('[data-consent-src]').forEach(function (el) {
      el.setAttribute('src', el.getAttribute('data-consent-src'));
      el.removeAttribute('data-consent-src');
    });
  }
  function decidir(valor) {
    almacen.guardar(CLAVE, JSON.stringify({ valor: valor, fecha: Date.now() }));
    aviso.hidden = true;
    if (valor === 'aceptar') cargarTerceros();
  }
  if (aviso) {
    var actual = eleccion();
    if (!actual) aviso.hidden = false;
    else if (actual === 'aceptar') cargarTerceros();
    aviso.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cookies]');
      if (b) decidir(b.getAttribute('data-cookies'));
    });
    document.querySelectorAll('[data-abrir-cookies]').forEach(function (b) {
      b.addEventListener('click', function () { aviso.hidden = false; aviso.querySelector('[data-cookies="denegar"]').focus(); });
    });
  }

  /* ---------- Contacto: desplegable «Soy» elegido desde el enlace (?soy=marca) ---------- */
  var params = new URLSearchParams(window.location.search);
  var soy = document.getElementById('cf-soy');
  if (soy && params.get('soy')) {
    var opcion = soy.querySelector('option[value="' + params.get('soy').replace(/[^a-z]/g, '') + '"]');
    if (opcion) soy.value = opcion.value;
  }

  /* ---------- Formularios (contacto y newsletter) ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var reglas = {
    nombre: function (el) { return el.value.trim().length >= 2 ? '' : 'Dinos tu nombre.'; },
    email: function (el) {
      if (!el.value.trim()) return 'Falta tu email.';
      return EMAIL_RE.test(el.value.trim()) ? '' : 'Revisa el email, parece que tiene algún error.';
    },
    soy: function (el) { return el.value ? '' : 'Elige una opción.'; },
    mensaje: function (el) { return el.value.trim().length >= 10 ? '' : 'Cuéntanos un poco más (mínimo 10 caracteres).'; },
    privacidad: function (el) { return el.checked ? '' : 'Marca la casilla para poder enviarlo.'; },
    consentimiento: function (el) { return el.checked ? '' : 'Marca la casilla para apuntarte.'; }
  };

  // Mensajes al volver de un envío sin JavaScript (?enviado=contacto / ?error=…)
  var MENSAJES_OK = {
    contacto: '¡Gracias! Hemos recibido tu mensaje y te responderemos pronto.',
    newsletter: '¡Hecho! Ya estás en la lista.'
  };

  document.querySelectorAll('[data-formulario]').forEach(function (form) {
    var status = form.querySelector('.form-status');
    var boton = form.querySelector('[type="submit"]');
    var textoBoton = boton.textContent;
    var tipo = form.elements.tipo.value;
    // Marca de tiempo: los robots suelen enviar en menos de 3 segundos
    form.elements.t.value = String(Date.now());

    function validarCampo(el) {
      var regla = reglas[el.name];
      if (!regla) return true;
      var msg = regla(el);
      var campo = el.closest('.field');
      var errorEl = document.getElementById(el.id + '-error');
      campo.classList.toggle('has-error', !!msg);
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (errorEl) {
        errorEl.textContent = msg;
        if (msg) el.setAttribute('aria-describedby', errorEl.id); else el.removeAttribute('aria-describedby');
      }
      return !msg;
    }
    function validar() {
      var primero = null;
      Array.prototype.forEach.call(form.elements, function (el) {
        if (reglas[el.name] && !validarCampo(el) && !primero) primero = el;
      });
      if (primero) primero.focus();
      return !primero;
    }
    function estado(tipoMsg, texto) {
      status.className = 'form-status' + (tipoMsg ? ' is-' + tipoMsg : '');
      status.textContent = texto || '';
    }

    if (params.get('enviado') === tipo) estado('success', MENSAJES_OK[tipo]);
    if (params.get('error') === tipo) estado('error', 'No se ha podido enviar. Inténtalo de nuevo o escríbenos directamente al email.');

    form.addEventListener('input', function (e) {
      var campo = e.target.closest('.field');
      if (campo && campo.classList.contains('has-error')) validarCampo(e.target);
    });
    form.addEventListener('change', function (e) {
      if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') validarCampo(e.target);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      estado('', '');
      if (!validar()) return;
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      fetch(form.getAttribute('action'), {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (datos) {
          if (!res.ok) throw new Error(datos.error || 'HTTP ' + res.status);
          return datos;
        });
      }).then(function () {
        form.reset();
        form.elements.t.value = String(Date.now());
        estado('success', MENSAJES_OK[tipo]);
      }).catch(function (err) {
        var texto = err && err.message && !/^HTTP/.test(err.message) ? err.message
          : 'No se ha podido enviar. Inténtalo de nuevo en unos minutos o escríbenos directamente al email.';
        estado('error', texto);
      }).then(function () {
        boton.disabled = false;
        boton.textContent = textoBoton;
      });
    });
  });
})();
