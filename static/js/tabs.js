// Tabs for leg pages (Overview / Stories / Theme Songs / YouTube Videos) and The House (Build Log,
// Design, …): templates/trip.html and templates/house.html.
// Each tab is a link to its section, so the address (#stories) can be shared, and a link to anything
// inside a section (a map stop, a day) opens that tab first.
(() => {
  const nav = document.querySelector('[data-tabs]');
  if (!nav) return;
  const tabs = [...nav.querySelectorAll('[data-tab]')];
  const panels = tabs.map(t => document.getElementById(t.dataset.tab)).filter(Boolean);
  // fade the right edge while more tabs are hidden off to the side
  const edge = () => nav.classList.toggle('has-more', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
  nav.addEventListener('scroll', edge, { passive: true });
  addEventListener('resize', edge);
  const show = id => {
    panels.forEach(p => { p.hidden = p.id !== id; });
    tabs.forEach(t => t.toggleAttribute('aria-current', t.dataset.tab === id));
    // on a phone the bar scrolls: keep the open tab in view
    const on = tabs.find(t => t.dataset.tab === id);
    if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - nav.offsetLeft - 16;
    edge();
    if (id === 'overview' && window.tripMap) window.tripMap.resize();   // the map was drawn while hidden
    dispatchEvent(new CustomEvent('tab:show', { detail: id }));   // e.g. the house timeline re-centres
  };
  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    const panel = el && panels.find(p => p === el || p.contains(el));
    show(panel ? panel.id : panels[0].id);
    if (panel && el !== panel) el.scrollIntoView();
  };
  tabs.forEach(t => t.addEventListener('click', e => {
    e.preventDefault();
    show(t.dataset.tab);
    history.replaceState(null, '', '#' + t.dataset.tab);
    if (nav.getBoundingClientRect().top < 0) nav.scrollIntoView();
  }));
  addEventListener('hashchange', fromHash);
  fromHash();
})();
