// Live filter for the recipe index: every word typed must appear in a card's data-search text.
(() => {
  const q = document.getElementById('q');
  const cards = [...document.querySelectorAll('#results [data-search]')];
  const empty = document.getElementById('empty');
  if (!q) return;
  const run = () => {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const c of cards) {
      const hit = words.every(w => c.dataset.search.includes(w));
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
