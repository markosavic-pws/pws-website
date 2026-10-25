// Trip maps: OpenStreetMap data from our own map files (PMTiles on R2), drawn with MapLibre and the
// Protomaps basemap style. Routes follow the roads, one colour per leg; numbered stops jump to
// their moment on the page. Zoom with pinch, ctrl/⌘ + scroll, or the buttons (the page keeps
// scrolling). Nothing loads from anyone else's servers. See tools/maps.py and rules/travel.md.
const el = document.getElementById('trip-map');
if (el && window.pmtiles && window.basemaps) init().catch(err => { console.error(err); el.classList.add('is-failed'); });

async function init() {
  const maplibregl = await import(el.dataset.lib);
  // absolute URLs, without escaping MapLibre's {fontstack}/{range} placeholders
  const abs = p => /^https?:/.test(p) ? p : location.origin + p;
  const data = await fetch(el.dataset.src).then(r => r.json());
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const flavor = basemaps.namedFlavor(dark ? 'dark' : 'light');
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  // the overview (all of North America, less detail) everywhere, and street detail along the
  // route once you zoom in; land and water from the overview stay underneath at every zoom
  const split = +el.dataset.detailMin || 8.5;
  const attribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>';
  const sources = { overview: { type: 'vector', url: 'pmtiles://' + abs(el.dataset.overview), attribution } };
  const keep = id => ['background', 'earth', 'water'].includes(id) || id.startsWith('landuse') || id.startsWith('landcover');
  const layers = basemaps.layers('overview', flavor, { lang: 'en' })
    .map(l => (keep(l.id) || !el.dataset.detail) ? l : { ...l, maxzoom: Math.min(l.maxzoom ?? 24, split) });
  if (el.dataset.detail) {
    sources.detail = { type: 'vector', url: 'pmtiles://' + abs(el.dataset.detail), attribution };
    for (const l of basemaps.layers('detail', flavor, { lang: 'en' })) {
      if (l.type === 'background') continue;
      layers.push({ ...l, id: 'd-' + l.id, minzoom: Math.max(l.minzoom ?? 0, split) });
    }
  }
  const map = new maplibregl.Map({
    container: el,
    style: { version: 8, sources, layers,
      glyphs: abs(el.dataset.glyphs), sprite: abs(el.dataset.sprite + (dark ? 'dark' : 'light')) },
    bounds: bounds(data), fitBoundsOptions: { padding: 48 },
    cooperativeGestures: true, attributionControl: { compact: true }, maxZoom: 15,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  window.tripMap = map;   // tabs.js resizes it when the Overview tab is shown

  // draw our layers as soon as the style is ready; map tiles fill in as they arrive
  map.once('style.load', () => {
    // routes: a white casing under each coloured line so it reads on any background
    map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: data.routes.map(r => (
      { type: 'Feature', properties: { color: r.color, url: r.url || '', name: r.name || '' },
        geometry: { type: 'LineString', coordinates: r.coords } })) } });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'routes', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': dark ? '#0b1020' : '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 5, 10, 9] } });
    map.addLayer({ id: 'route', type: 'line', source: 'routes', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3, 10, 5] } });
    // the planned route's towns and parks: small dots, named on hover
    map.addSource('waypoints', { type: 'geojson', data: points(data.waypoints || []) });
    map.addLayer({ id: 'waypoints', type: 'circle', source: 'waypoints',
      paint: { 'circle-radius': 4.5, 'circle-color': '#fff', 'circle-stroke-color': '#333', 'circle-stroke-width': 2 } });
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    map.on('mouseenter', 'waypoints', e => {
      const p = e.features[0].properties;
      tip.setLngLat(e.lngLat).setText(p.date ? `${p.name} · ${p.date}` : p.name).addTo(map);
    });
    map.on('mouseleave', 'waypoints', () => tip.remove());
    // on the whole-trip page, a leg's line goes to that leg
    map.on('click', 'route', e => { const u = e.features[0].properties.url; if (u) location.href = u; });
    map.on('mouseenter', 'route', e => { if (e.features[0].properties.url) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'route', () => { map.getCanvas().style.cursor = ''; });
    el.classList.add('is-ready');
  });

  // numbered stops (links to their moment on the page) and EV chargers, as HTML markers
  for (const s of data.stops || []) {
    const a = Object.assign(document.createElement('a'), { href: '#' + s.anchor, className: 'map-stop', textContent: s.n,
      title: `${s.n}. ${s.name}${s.town && s.town !== s.name ? ', ' + s.town : ''}` });
    new maplibregl.Marker({ element: a }).setLngLat([s.lon, s.lat]).addTo(map);
  }
  for (const c of data.chargers || []) {
    const b = Object.assign(document.createElement('span'), { className: 'map-charger',
      title: `Charging: ${c.name}${c.when ? ' (' + c.when.toLowerCase() + ')' : ''}` });
    b.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M9.5 1L3.5 9.5h4l-1 5.5 6-8.5h-4z" fill="currentColor"/></svg>';
    new maplibregl.Marker({ element: b, offset: [14, -12] }).setLngLat([c.lon, c.lat]).addTo(map);
  }
}

function points(list) {
  return { type: 'FeatureCollection', features: list.map(p => (
    { type: 'Feature', properties: { name: p.name, date: p.date || '' }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })) };
}

function bounds(d) {
  const xs = [], ys = [];
  const add = (x, y) => { xs.push(x); ys.push(y); };
  (d.routes || []).forEach(r => r.coords.forEach(([x, y]) => add(x, y)));
  [...(d.stops || []), ...(d.chargers || []), ...(d.waypoints || [])].forEach(p => add(p.lon, p.lat));
  const pad = xs.length > 1 ? 0 : 0.2;
  return [[Math.min(...xs) - pad, Math.min(...ys) - pad], [Math.max(...xs) + pad, Math.max(...ys) + pad]];
}
