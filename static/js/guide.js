// Travel guides (templates/guide.html): search and filters for the lists, and one map for the whole
// guide that follows the open region tab (static/js/tabs.js) and the filters. Pins are coloured by
// favourite / been / haven't been yet; tap one for its name, or "Map" on a place.
const data = JSON.parse(document.getElementById('guide-data').textContent);
const controls = document.querySelector('[data-guide-controls]');
const search = controls.querySelector('.guide-search');
const count = controls.querySelector('.guide-count');
const state = { region: 'overview', type: '', status: '', occasion: false };
let map = null, popup = null, maplibre = null;
controls.hidden = false;

const words = () => search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
const matches = (p, region) => (region === 'overview' || p.region === region)
  && (!state.type || p.type === state.type) && (!state.status || p.status === state.status)
  && (!state.occasion || p.occasion)
  && words().every(w => p.search.includes(w));

function apply() {
  // lists: each region's places, grouped by type
  document.querySelectorAll('.guide-panel[data-region]').forEach(panel => {
    let shown = 0;
    panel.querySelectorAll('.place-group').forEach(g => {
      let n = 0;
      g.querySelectorAll('.place').forEach(li => {
        const ok = matches({ region: panel.dataset.region, type: li.dataset.type, status: li.dataset.status,
          occasion: !!li.dataset.occasion, search: li.dataset.search }, panel.dataset.region);
        li.hidden = !ok; n += ok;
      });
      g.hidden = n === 0; shown += n;
    });
    panel.querySelector('.guide-none').hidden = shown > 0;
  });
  const visible = data.points.filter(p => matches(p, state.region));
  const total = document.querySelectorAll(state.region === 'overview' ? '.guide-panel[data-region] .place'
    : `.guide-panel[data-region="${state.region}"] .place`).length;
  const shownCount = [...document.querySelectorAll(state.region === 'overview' ? '.guide-panel[data-region] .place'
    : `.guide-panel[data-region="${state.region}"] .place`)].filter(li => !li.hidden).length;
  count.textContent = shownCount === total ? `${total} places` : `Showing ${shownCount} of ${total}`;
  if (map && map.getSource('places')) {
    map.getSource('places').setData(features(visible));
  }
  return visible;
}

function features(list) {
  return { type: 'FeatureCollection', features: list.map(p => ({ type: 'Feature',
    properties: { id: p.id, name: p.name, town: p.town, status: p.status, approx: p.approx ? 1 : 0 },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })) };
}

function fit(list) {
  if (!map || !list.length) return;
  const xs = list.map(p => p.lon), ys = list.map(p => p.lat);
  map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
    { padding: 50, maxZoom: 12, duration: 600 });
}

controls.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
  state.type = b.dataset.type;
  controls.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  apply();
}));
controls.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => {
  state.status = b.dataset.status;
  controls.querySelectorAll('[data-status]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  apply();
}));
const occ = controls.querySelector('[data-occasion]');
occ.addEventListener('click', () => { state.occasion = !state.occasion; occ.setAttribute('aria-pressed', String(state.occasion)); apply(); });
search.addEventListener('input', apply);
addEventListener('tab:show', e => { state.region = e.detail; fit(apply()); });

// "Map" on a place: show it on the map
document.addEventListener('click', e => {
  const a = e.target.closest('.place-on-map');
  if (!a || !map) return;
  e.preventDefault();
  const p = data.points.find(x => x.id === a.dataset.map);
  if (!p) return;
  document.getElementById('guide-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 13) });
  show(p);
});

function show(p) {
  popup.setLngLat([p.lon, p.lat]).setHTML('').addTo(map);
  const el = document.createElement('div');
  const a = Object.assign(document.createElement('a'), { href: '#' + p.id, textContent: p.name });
  const meta = Object.assign(document.createElement('div'), { className: 'pin-meta',
    textContent: [p.town, p.approx ? 'approximate location' : ''].filter(Boolean).join(' · ') });
  el.append(a, meta);
  popup.setDOMContent(el);
}

state.region = document.querySelector('.tab-panel:not([hidden])')?.id || 'overview';
apply();

// the map: same self-hosted setup as the trip maps (static/js/tripmap.js)
const el = document.getElementById('guide-map');
if (el && window.pmtiles && window.basemaps) initMap().catch(err => { console.error(err); el.classList.add('is-failed'); });

async function initMap() {
  maplibre = await import(el.dataset.lib);
  const abs = p => /^https?:/.test(p) ? p : location.origin + p;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const flavor = basemaps.namedFlavor(dark ? 'dark' : 'light');
  const protocol = new pmtiles.Protocol();
  maplibre.addProtocol('pmtiles', protocol.tile);
  const split = +el.dataset.detailMin || 8.5;
  const attribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>';
  const keep = id => ['background', 'earth', 'water'].includes(id) || id.startsWith('landuse') || id.startsWith('landcover');
  const sources = { overview: { type: 'vector', url: 'pmtiles://' + abs(el.dataset.overview), attribution },
    detail: { type: 'vector', url: 'pmtiles://' + abs(el.dataset.detail), attribution } };
  const layers = basemaps.layers('overview', flavor, { lang: 'en' })
    .map(l => keep(l.id) ? l : { ...l, maxzoom: Math.min(l.maxzoom ?? 24, split) });
  for (const l of basemaps.layers('detail', flavor, { lang: 'en' })) {
    if (l.type !== 'background') layers.push({ ...l, id: 'd-' + l.id, minzoom: Math.max(l.minzoom ?? 0, split) });
  }
  const xs = data.points.map(p => p.lon), ys = data.points.map(p => p.lat);
  map = new maplibre.Map({ container: el,
    style: { version: 8, sources, layers, glyphs: abs(el.dataset.glyphs), sprite: abs(el.dataset.sprite + (dark ? 'dark' : 'light')) },
    bounds: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], fitBoundsOptions: { padding: 40 },
    cooperativeGestures: true, attributionControl: { compact: true }, maxZoom: 16 });
  map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
  popup = new maplibre.Popup({ closeButton: true, offset: 10, maxWidth: '260px' });
  map.once('style.load', () => {
    map.addSource('places', { type: 'geojson', data: features(apply()) });
    map.addLayer({ id: 'pins', type: 'circle', source: 'places', paint: {
      // favourites are bigger, with a yellow ring; places Marko has been are blue, the rest yellow
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'status'], 'favourite', 6, 4], 12, ['match', ['get', 'status'], 'favourite', 11, 8]],
      'circle-color': ['match', ['get', 'status'], 'favourite', '#094cdc', 'been', '#094cdc', '#ffda00'],
      'circle-stroke-color': ['match', ['get', 'status'], 'favourite', '#ffda00', '#ffffff'],
      'circle-stroke-width': ['match', ['get', 'status'], 'favourite', 3, 1.5],
      'circle-opacity': ['case', ['==', ['get', 'approx'], 1], 0.55, 1] } });
    map.on('click', 'pins', e => { const p = data.points.find(x => x.id === e.features[0].properties.id); if (p) show(p); });
    map.on('mouseenter', 'pins', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'pins', () => { map.getCanvas().style.cursor = ''; });
    el.classList.add('is-ready');
    if (state.region !== 'overview') fit(data.points.filter(p => matches(p, state.region)));
  });
}
