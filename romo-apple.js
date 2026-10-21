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
  const thumbs = () => document.querySelectorAll('.steps, .seg').forEach(thumb);

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

  let pend = 0; const pronto = () => { if (!pend) { pend = 1; queueMicrotask(() => { pend = 0; thumbs(); }); } };   // antes de pintar
  const go = () => {
    menuCuenta(); thumbs();
    new MutationObserver(pronto).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'class'] });
    addEventListener('resize', pronto);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
