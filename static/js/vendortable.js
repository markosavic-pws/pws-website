// Product tables on The House tabs (Made in Canada): search plus one filter per group (templates/house.html).
// Without JavaScript the full table shows.
(() => {
  document.querySelectorAll('[data-vendor-tools]').forEach(tools => {
    const table = tools.nextElementSibling.querySelector('table');
    const rows = [...table.querySelectorAll('tbody tr[data-group]')];
    const none = table.querySelector('.vendor-none');
    const search = tools.querySelector('.vendor-search');
    const chips = [...tools.querySelectorAll('[data-group]')];
    const count = tools.querySelector('.vendor-count');
    let group = '';
    tools.hidden = false;
    const apply = () => {
      const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let shown = 0;
      rows.forEach(r => {
        const ok = (!group || r.dataset.group === group) && words.every(w => r.dataset.search.includes(w));
        r.hidden = !ok;
        shown += ok;
      });
      none.hidden = shown > 0;
      count.textContent = shown === rows.length ? `${rows.length} products` : `Showing ${shown} of ${rows.length}`;
    };
    chips.forEach(c => c.addEventListener('click', () => {
      group = c.dataset.group;
      chips.forEach(x => x.setAttribute('aria-pressed', String(x === c)));
      apply();
    }));
    search.addEventListener('input', apply);
    apply();
  });
})();
