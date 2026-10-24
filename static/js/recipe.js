// Recipe page controls: weight/volume switch and recipe scaling (1×/2×/3× or pan sizes).
(() => {
  const root = document.querySelector('.recipe');
  if (!root) return;
  const nums = [...root.querySelectorAll('.ingredients .n')];
  nums.forEach(n => { n.dataset.o = n.textContent; });

  // --- units -------------------------------------------------------------
  const KEY = 'pws-units';
  const unitButtons = [...root.querySelectorAll('[data-units]')].filter(b => b.tagName === 'BUTTON');
  const setUnits = u => {
    root.dataset.units = u;
    unitButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.units === u)));
    try { localStorage.setItem(KEY, u); } catch (e) {}
  };
  unitButtons.forEach(b => b.addEventListener('click', () => setUnits(b.dataset.units)));
  try { const saved = localStorage.getItem(KEY); if (saved === 'volume') setUnits('volume'); } catch (e) {}

  // --- scaling -----------------------------------------------------------
  // the measures cooks actually own; 1/8 only below 1/4 (pinches of salt, spices)
  const FRACTIONS = [[0, ''], [1/8, '1/8'], [1/4, '1/4'], [1/3, '1/3'], [1/2, '1/2'],
                     [2/3, '2/3'], [3/4, '3/4'], [1, '']];
  // keep "1 cup" / "2 cups" grammatical as amounts change
  const UNIT = /^(\s?)(cup|teaspoon|tablespoon|pint|stick|clove|can|bunch|head|sprig|slice|piece)(s|es)?\b/;
  const plural = (n, v) => {
    const t = n.nextSibling;
    if (!t || t.nodeType !== 3) return;
    if (t.o === undefined) t.o = t.textContent;
    const m = t.o.match(UNIT);
    if (!m) return;
    const word = v > 1 ? m[2] + (m[2] === 'bunch' ? 'es' : 's') : m[2];
    t.textContent = v === null ? t.o : t.o.replace(UNIT, m[1] + word);
  };
  const fraction = v => {
    if (v >= 10) return String(Math.round(v));
    let whole = Math.floor(v);
    const [val, label] = FRACTIONS.reduce((a, f) => Math.abs(f[0] - (v - whole)) < Math.abs(a[0] - (v - whole)) ? f : a);
    if (val === 1) whole += 1;
    if (!label) return String(whole || (v > 0 ? '1/8' : 0));
    return whole ? `${whole}-${label}` : label;
  };
  const metric = v => {
    const r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    return r.toLocaleString('en-CA');
  };
  const isMetric = n => !!n.closest('.u-w') || /^\s?(g|kg|ml|mL|L)\b/.test(n.nextSibling?.textContent || '');

  const scaleButtons = [...root.querySelectorAll('[data-scale]')];
  const note = root.querySelector('.scale-note');
  const setScale = f => {
    scaleButtons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.scale) === f)));
    if (note) note.hidden = f === 1;
    nums.forEach(n => {
      if (f === 1) { n.textContent = n.dataset.o; plural(n, null); return; }
      const fmt = isMetric(n) ? metric : fraction;
      const hi = Number(n.dataset.n2 || n.dataset.n) * f;
      const a = fmt(Number(n.dataset.n) * f);
      const b = n.dataset.n2 ? '–' + fmt(hi) : '';
      n.textContent = (n.dataset.approx || '') + a + b;
      plural(n, hi);
    });
  };
  scaleButtons.forEach(b => b.addEventListener('click', () => setScale(Number(b.dataset.scale))));
})();
