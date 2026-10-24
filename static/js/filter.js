// Live filter for the recipe index: every word typed must appear in a card's data-search text.
(() => {
  const q = document.getElementById('q');
  const cards = [...document.querySelectorAll('#results [data-search]')];
  const empty = document.getElementById('empty');
  if (!q) return;
  let source = 'all';
  const chips = [...document.querySelectorAll('[data-source]')].filter(b => b.tagName === 'BUTTON');
  chips.forEach(b => b.addEventListener('click', () => {
    source = b.dataset.source;
    chips.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    run();
  }));
  const run = () => {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const c of cards) {
      const hit = words.every(w => c.dataset.search.includes(w)) && (source === 'all' || (source === 'video' ? c.dataset.video === '1' : c.dataset.source === source));
      c.hidden = !hit;
      if (hit) shown++;
    }
    empty.hidden = shown > 0;
    history.replaceState(null, '', q.value ? `?q=${encodeURIComponent(q.value)}` : location.pathname);
  };
  q.value = new URLSearchParams(location.search).get('q') || '';
  q.addEventListener('input', run);
  if (q.value) run();
})();
