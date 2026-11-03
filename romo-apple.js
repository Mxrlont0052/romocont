// ROMO · comportamientos de la piel estilo Apple (aprobada 20-10-2026). No toca la lógica ni la API de la página.
//  · Segmentados (.steps, .seg): pulgar gris que se desliza con resorte (controles.md). La página puede rehacer los
//    botones en cada clic: el pulgar sale desde donde estaba.
//  · Tarjeta de cuenta (.me[data-menu]): menú que sale desde la tarjeta con el correo y Salir (en rojo).
(() => {
  function thumb(c) {
    let th = c.querySelector(':scope > .thumb-seg');
    if (!th) {
      th = document.createElement('i'); th.className = 'thumb-seg'; c.prepend(th);
      if (c.dataset.x) { th.style.transform = `translateX(${c.dataset.x}px)`; th.style.width = c.dataset.w + 'px'; th.classList.add('on', 'sin-anim'); th.offsetWidth; th.classList.remove('sin-anim'); }
      else th.classList.add('sin-anim');
    }
    const b = c.querySelector(':scope > button[aria-pressed="true"]');
    if (!b || !b.offsetWidth) { if (th.classList.contains('on')) th.classList.remove('on'); return; }
    const x = b.offsetLeft, w = b.offsetWidth;
    if (th.dataset.x != x || th.dataset.w != w) { th.style.transform = `translateX(${x}px)`; th.style.width = w + 'px'; th.dataset.x = c.dataset.x = x; th.dataset.w = c.dataset.w = w; }
    if (!th.classList.contains('on')) th.classList.add('on');
    if (th.classList.contains('sin-anim')) { th.offsetWidth; th.classList.remove('sin-anim'); }
  }
  const thumbs = () => document.querySelectorAll('.steps, .seg, .pub-dias').forEach(thumb);
  // Teléfono: si en la barra hay un solo apartado visible, no se repite como cápsula (Lizy solo tiene Publicar).
  function soloUno() {
    const side = document.querySelector('.side'); if (!side) return;
    const n = [...side.querySelectorAll(':scope > a')].filter(x => !x.classList.contains('hidden')).length;
    if ((n <= 1) !== side.hasAttribute('data-solo')) side.toggleAttribute('data-solo', n <= 1);
  }

  function menuCuenta() {
    const me = document.querySelector('.me[data-menu]'), m = document.querySelector('.menu-cuenta');
    if (!me || !m) return;
    const abrir = v => { m.querySelector('.hd').textContent = me.dataset.correo || ''; m.classList.toggle('open', v); me.setAttribute('aria-expanded', v); };
    me.addEventListener('click', e => { e.stopPropagation(); abrir(!m.classList.contains('open')); });
    me.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(true); m.querySelector('button:not(.hidden *)').focus(); } });
    m.addEventListener('click', e => { if (e.target.closest('button')) abrir(false); });   // cualquier opción cierra el menú
    m.querySelector('[data-salir]').addEventListener('click', () => document.getElementById('salir').click());
    document.addEventListener('click', e => { if (!m.contains(e.target)) abrir(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('open')) { abrir(false); me.focus(); } });
  }

  // Editores en el teléfono: ¿ya están listos todos los de la cola? (el rojo pasa de «Siguiente» a «Renderizar»)
  function todosListos() {
    const p = document.getElementById('pMarcar'), cola = document.getElementById('cola'); if (!p || !cola) return;
    const n = cola.children.length, ok = cola.querySelectorAll('.tag.ok').length, todos = n > 0 && ok === n;
    if (todos !== p.hasAttribute('data-todos')) p.toggleAttribute('data-todos', todos);
  }
  // Visor de video (03-11-2026): hoja que sube. o = { titulo, sub, src, otro (si src falla), drive (link de Drive) }.
  // El dashboard (iframe) lo abre aquí con parent.verVideo para que tape toda la pantalla.
  const driveId = u => (String(u || '').match(/\/file\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/) || []).slice(1).find(Boolean);
  let visor, antes;
  function cerrarVisor() {
    if (!visor || !visor.classList.contains('open')) return;
    visor.classList.remove('open');
    const v = visor.querySelector('.visor-v'); setTimeout(() => { if (!visor.classList.contains('open')) v.innerHTML = ''; }, 300);   // corta el video
    if (antes && antes.isConnected) antes.focus();
  }
  window.verVideo = o => {
    if (!visor) {
      visor = document.createElement('div'); visor.className = 'visor';
      visor.innerHTML = '<div class="visor-h" role="dialog" aria-modal="true"><div class="visor-cab"><div style="flex:1;min-width:0"><div class="t"></div><div class="m"></div></div>'
        + '<button class="visor-x" aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><div class="visor-v"></div></div>';
      document.body.append(visor);
      visor.addEventListener('click', e => { if (e.target === visor || e.target.closest('.visor-x')) cerrarVisor(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarVisor(); });
    }
    antes = document.activeElement;
    visor.querySelector('.t').textContent = o.titulo || 'Video';
    visor.querySelector('.m').textContent = o.sub || '';
    const caja = visor.querySelector('.visor-v'), id = driveId(o.drive);
    const aviso = t => { caja.innerHTML = '<div class="aviso"></div>'; caja.firstChild.textContent = t; };
    if (o.src) {
      caja.innerHTML = '<video controls autoplay playsinline preload="metadata"></video>';
      const v = caja.firstChild; let otro = o.otro;
      v.onerror = () => { if (otro) { v.src = otro; otro = null; } else aviso('Este video todavía no se puede ver.'); };
      v.src = o.src;
    } else if (id) caja.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    else aviso('Este video no tiene archivo en Drive.');
    visor.offsetWidth; visor.classList.add('open');
    visor.querySelector('.visor-x').focus({ preventScroll: true });
  };

  let pend = 0; const pronto = () => { if (!pend) { pend = 1; queueMicrotask(() => { pend = 0; thumbs(); soloUno(); todosListos(); }); } };   // antes de pintar
  const go = () => {
    menuCuenta(); thumbs(); soloUno(); todosListos();
    new MutationObserver(pronto).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'class'] });
    addEventListener('resize', pronto);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
