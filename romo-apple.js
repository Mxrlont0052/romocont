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
  let pend = 0; const pronto = () => { if (!pend) { pend = 1; queueMicrotask(() => { pend = 0; thumbs(); soloUno(); todosListos(); }); } };   // antes de pintar
  const go = () => {
    menuCuenta(); thumbs(); soloUno(); todosListos();
    new MutationObserver(pronto).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'class'] });
    addEventListener('resize', pronto);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
