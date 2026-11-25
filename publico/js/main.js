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
  // Con «reducir movimiento» también se observa: en Nosotros se hace un fundido suave sin desplazamiento.
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* [MOV-4] Nosotros: en cuanto la sección asoma, aparecen sus elementos uno detrás de otro */
  var nosotros = document.getElementById('nosotros');
  if (nosotros && 'IntersectionObserver' in window) {
    var ioNosotros = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      nosotros.classList.add('intro--visible');
      ioNosotros.disconnect();
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    ioNosotros.observe(nosotros);
  } else if (nosotros) {
    nosotros.classList.add('intro--visible');
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
     MOVIMIENTO. Todo mueve solo posición, tamaño y opacidad (60 fps en móvil).
     Cada bloque [MOV-n] se puede borrar por separado si no gusta.
     ========================================================= */
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var limitar = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  // Progreso de un elemento al cruzar la pantalla: 0 cuando asoma por abajo, 1 cuando llega a «hasta» (fracción de pantalla).
  var progreso = function (r, hasta) { return limitar((vh - r.top) / (vh * (1 - hasta))); };

  // [MOV-1] Portada: el titular empieza oculto y aparece al empezar a bajar (--t). Sin «reducir movimiento»,
  // además el logo se encoge y el vídeo va más lento y se oscurece (--p).
  var portadaMov = document.querySelector('.portada');
  if (portadaMov) document.documentElement.classList.add('mov-portada');

  // [MOV-3] Nieve («La montaña»): el título se rellena, los logos se juntan y la montaña de fondo
  // se mueve más despacio que el texto (profundidad). La nieve que cae va aparte, más abajo.
  var nieveTitulo = !reduceMotion && document.querySelector('.snow__title');
  var nieveLockup = !reduceMotion && document.querySelector('.snow__lockup');
  var nieveEscena = !reduceMotion && document.querySelector('.snow--escena');
  if (nieveLockup) document.documentElement.classList.add('mov-nieve');

  var pendiente = false;
  function pedirFrame() { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } }
  function actualizar() {
    pendiente = false;
    // Primero se leen todas las medidas y después se escribe (evita recalcular la página varias veces)
    var rp = portadaMov && portadaMov.getBoundingClientRect();
    var rt = nieveTitulo && nieveTitulo.getBoundingClientRect();
    var rl = nieveLockup && nieveLockup.getBoundingClientRect();
    var re = nieveEscena && nieveEscena.getBoundingClientRect();

    if (rp && rp.bottom > 0) {
      // --t: antes hacía aparecer el titular / logo al bajar; desde el 24/11 el logo es fijo y ya no se usa
      portadaMov.style.setProperty('--t', limitar(-rp.top / (rp.height * 0.06)).toFixed(3));
      if (!reduceMotion) portadaMov.style.setProperty('--p', limitar(-rp.top / rp.height).toFixed(3));
    }
    if (rt && rt.top < vh && rt.bottom > 0) nieveTitulo.style.setProperty('--relleno', (progreso(rt, 0.35) * 100).toFixed(1) + '%');
    if (rl && rl.top < vh && rl.bottom > 0) nieveLockup.style.setProperty('--q', progreso(rl, 0.3).toFixed(3));
    // --pe va de 0 (la escena asoma por abajo) a 1 (ha salido por arriba)
    if (re && re.top < vh && re.bottom > 0) nieveEscena.style.setProperty('--pe', limitar((vh - re.top) / (vh + re.height)).toFixed(3));
  }
  window.addEventListener('scroll', pedirFrame, { passive: true });
  window.addEventListener('resize', function () { vh = window.innerHeight || document.documentElement.clientHeight; pedirFrame(); });
  pedirFrame();

  // [MOV-2] Próximos eventos: cinta continua que no para de moverse. Al mantener pulsado un flyer,
  // la cinta se detiene y ese flyer se agranda; al soltar, sigue. Con «reducir movimiento» queda el carrusel normal.
  var cinta = !reduceMotion && document.querySelector('[data-carrusel-scroll]');
  if (cinta && cinta.children.length) {
    var originales = Array.prototype.slice.call(cinta.children);
    // Copias para que la cinta no tenga final (solo decorativas: no se leen ni se puede llegar con el tabulador)
    var copiar = function () {
      originales.forEach(function (li) {
        var copia = li.cloneNode(true);
        copia.setAttribute('aria-hidden', 'true');
        copia.removeAttribute('data-fecha');
        copia.classList.add('evento--copia');
        copia.querySelectorAll('a, button').forEach(function (a) { a.setAttribute('tabindex', '-1'); });
        cinta.appendChild(copia);
      });
    };
    copiar();
    var anchoTanda = function () { return cinta.children[originales.length].offsetLeft - originales[0].offsetLeft; };
    // Hacen falta copias suficientes para cubrir la pantalla mientras se desplaza una tanda entera
    var vueltas = 0;
    while (cinta.scrollWidth < cinta.clientWidth + anchoTanda() * 2 && vueltas++ < 6) copiar();
    cinta.classList.add('carrusel--cinta');
    var seccionCinta = cinta.closest('section');
    if (seccionCinta) seccionCinta.classList.add('proximos--cinta');

    var x = 0;
    var velocidad = 32; // píxeles por segundo
    var parado = false;     // mantenido pulsado o arrastrando
    var visible = true;
    var ultimo = 0;
    var reanudarEn = 0;     // tras soltar, espera un poco antes de volver a moverse sola
    var destino = null;     // flyer al que se ajusta al soltar
    function envolver(v) {  // la cinta no tiene final: mantiene x dentro de una tanda
      var tanda = anchoTanda();
      if (tanda <= 0) return v;
      while (v > 0) v -= tanda;
      while (v <= -tanda) v += tanda;
      return v;
    }
    function paso() { return cinta.children[1] ? cinta.children[1].offsetLeft - cinta.children[0].offsetLeft : 1; }
    function avanzar(t) {
      var dt = ultimo ? Math.min(64, t - ultimo) / 1000 : 0;
      ultimo = t;
      if (visible && !parado) {
        if (destino !== null) {
          // Ajuste suave al flyer más cercano
          x += (destino - x) * Math.min(1, dt * 10);
          if (Math.abs(destino - x) < 0.5) { x = destino; destino = null; }
        } else if (t >= reanudarEn) {
          x -= velocidad * dt;
        }
        x = envolver(x);
        cinta.style.setProperty('--x', x.toFixed(2) + 'px');
      }
      requestAnimationFrame(avanzar);
    }
    requestAnimationFrame(avanzar);

    // Tocar: mantener pulsado para la cinta y destaca el flyer; arrastrar a los lados la mueve a mano
    var activo = null;
    var inicioX = 0, inicioY = 0, xAlEmpezar = 0, arrastrando = false, decidido = false, puntero = null;
    cinta.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      puntero = e.pointerId;
      inicioX = e.clientX; inicioY = e.clientY; xAlEmpezar = x;
      arrastrando = false; decidido = false; destino = null;
      parado = true;
      var li = e.target.closest('.evento');
      if (li) { activo = li; li.classList.add('is-activo'); }
    });
    cinta.addEventListener('pointermove', function (e) {
      if (e.pointerId !== puntero) return;
      var dx = e.clientX - inicioX, dy = e.clientY - inicioY;
      if (!decidido && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        decidido = true;
        arrastrando = Math.abs(dx) > Math.abs(dy); // si el gesto es vertical, se deja hacer scroll a la página
        if (arrastrando) {
          try { cinta.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
          if (activo) { activo.classList.remove('is-activo'); activo = null; }
        } else {
          soltar();
        }
      }
      if (arrastrando) {
        x = envolver(xAlEmpezar + dx);
        cinta.style.setProperty('--x', x.toFixed(2) + 'px');
      }
    });
    function soltar() {
      if (puntero === null && !parado) return;
      if (arrastrando) {
        var p = paso();
        destino = Math.round(x / p) * p; // se ajusta al flyer más cercano
      }
      puntero = null;
      parado = false;
      reanudarEn = performance.now() + (arrastrando ? 1800 : 300);
      if (activo) { activo.classList.remove('is-activo'); activo = null; }
      // Si ha sido un arrastre, el toque no abre el enlace
      if (arrastrando) {
        var bloquear = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
        cinta.addEventListener('click', bloquear, { capture: true, once: true });
        setTimeout(function () { cinta.removeEventListener('click', bloquear, { capture: true }); arrastrando = false; }, 400);
      }
    }
    ['pointerup', 'pointercancel'].forEach(function (ev) { cinta.addEventListener(ev, soltar); });
    cinta.addEventListener('pointerleave', function (e) { if (!arrastrando) soltar(e); });
    window.addEventListener('blur', soltar);

    // Sin moverse cuando no está a la vista (ahorra batería)
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(cinta);
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
    if (reduceMotion && !video.classList.contains('portada__video')) { video.removeAttribute('autoplay'); video.pause(); return; }
    if (!('IntersectionObserver' in window)) { video.play().catch(function () {}); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) video.play().catch(function () {});
        else video.pause();
      });
    }, { threshold: 0.2 }).observe(video);
  }
  controlarVideo(document.querySelector('.portada__video'), false); // desde el 21/11 también en ordenador
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
