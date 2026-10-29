// 地图显示：MapLibre（底图）+ H3（六边形格子）。两个库从 CDN 以全局变量加载。
import { EXPLORE, LANDMARKS } from './explore.js';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const H = () => window.h3;
const ML = () => window.maplibregl;

let view = null; // { map, el, ready, pending }
let landmarkByCell = null;

export const libsReady = () => !!(window.h3 && window.maplibregl);
export const cellAt = (lat, lng) => H().latLngToCell(lat, lng, EXPLORE.h3Resolution);
export const ringCells = (lat, lng) => H().gridDisk(cellAt(lat, lng), EXPLORE.revealRing);
export function cellCenter(cell) {
  const [lat, lng] = H().cellToLatLng(cell);
  return { lat, lng };
}

export function landmarkInCell(cell) {
  if (!landmarkByCell) landmarkByCell = Object.fromEntries(LANDMARKS.map((l) => [cellAt(l.lat, l.lng), l]));
  return landmarkByCell[cell] || null;
}

const signedArea = (ring) => ring.reduce((s, p, i) => {
  const q = ring[(i + 1) % ring.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2;
const withWinding = (ring, ccw) => ((signedArea(ring) > 0) === ccw ? ring : [...ring].reverse());

function hexFeatures(cells, props = {}) {
  return cells.map((c) => ({
    type: 'Feature',
    properties: { cell: c, ...props },
    geometry: { type: 'Polygon', coordinates: [H().cellToBoundary(c, true)] },
  }));
}

// 迷雾：覆盖全世界的多边形，挖掉到过的区域；到过区域内部的空洞重新补上迷雾
function fogFeatures(visitedCells) {
  const world = withWinding([[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], true);
  const polys = visitedCells.length ? H().cellsToMultiPolygon(visitedCells, true) : [];
  const holes = polys.map((p) => withWinding(p[0], false));
  const features = [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ...holes] } }];
  for (const p of polys) {
    for (const inner of p.slice(1)) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [withWinding(inner, true)] } });
    }
  }
  return features;
}

const fc = (features) => ({ type: 'FeatureCollection', features });
const point = (lat, lng, props = {}) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [lng, lat] } });

export function mount(slot, { onCellClick, initial }) {
  if (view) {
    slot.appendChild(view.el);
    requestAnimationFrame(() => view.map.resize());
    return;
  }
  const el = document.createElement('div');
  el.id = 'map';
  slot.appendChild(el);
  const map = new (ML().Map)({
    container: el,
    style: STYLE,
    center: initial ? [initial.lng, initial.lat] : [-96, 58],
    zoom: initial ? 13.5 : 2.6,
    attributionControl: { compact: true },
  });
  map.addControl(new (ML().NavigationControl)({ showCompass: false }), 'top-right');
  view = { map, el, ready: false, pending: null };
  if (new URLSearchParams(location.search).has('debug')) window.__fengtuMap = map;
  map.on('load', () => {
    const empty = fc([]);
    for (const id of ['fog', 'visited', 'lit', 'landmarks', 'bases', 'me']) map.addSource(id, { type: 'geojson', data: empty });
    map.addLayer({ id: 'visited-fill', type: 'fill', source: 'visited', paint: { 'fill-color': '#8f857d', 'fill-opacity': 0.28 } });
    map.addLayer({ id: 'visited-line', type: 'line', source: 'visited', paint: { 'line-color': '#8f857d', 'line-width': 0.6, 'line-opacity': 0.6 } });
    map.addLayer({ id: 'lit-fill', type: 'fill', source: 'lit', paint: { 'fill-color': '#f0a23a', 'fill-opacity': 0.38 } });
    map.addLayer({ id: 'lit-line', type: 'line', source: 'lit', paint: { 'line-color': '#b4442f', 'line-width': 0.8 } });
    map.addLayer({ id: 'fog', type: 'fill', source: 'fog', paint: { 'fill-color': '#2f2a26', 'fill-opacity': 0.82 } });
    map.addLayer({ id: 'landmarks', type: 'circle', source: 'landmarks', paint: { 'circle-radius': 7, 'circle-color': '#f0a23a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'bases', type: 'circle', source: 'bases', paint: { 'circle-radius': 6, 'circle-color': '#6a5acd', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#2b7de9', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
    el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    view.ready = true;
    if (view.pending) update(...view.pending);
  });
  map.on('click', (e) => onCellClick?.(cellAt(e.lngLat.lat, e.lngLat.lng)));
}

export function update(mapState, me) {
  if (!view) return;
  if (!view.ready) { view.pending = [mapState, me]; return; }
  const visited = Object.keys(mapState.visited);
  const lit = Object.keys(mapState.lit);
  const litSet = new Set(lit);
  const m = view.map;
  m.getSource('fog').setData(fc(fogFeatures(visited)));
  m.getSource('visited').setData(fc(hexFeatures(visited.filter((c) => !litSet.has(c)))));
  m.getSource('lit').setData(fc(hexFeatures(lit)));
  m.getSource('landmarks').setData(fc(LANDMARKS.filter((l) => litSet.has(cellAt(l.lat, l.lng))).map((l) => point(l.lat, l.lng, { id: l.id }))));
  m.getSource('bases').setData(fc(mapState.bases.map((b) => point(b.lat, b.lng, { id: b.id }))));
  m.getSource('me').setData(fc(me ? [point(me.lat, me.lng)] : []));
}

export function flyTo(lat, lng, zoom = 14) {
  view?.map.flyTo({ center: [lng, lat], zoom, essential: true });
}

// 探索时跟随：位置快要出画面时把地图移过去
export function follow(lat, lng) {
  if (!view) return;
  const b = view.map.getBounds();
  const padLat = (b.getNorth() - b.getSouth()) * 0.2;
  const padLng = (b.getEast() - b.getWest()) * 0.2;
  if (lat > b.getNorth() - padLat || lat < b.getSouth() + padLat || lng > b.getEast() - padLng || lng < b.getWest() + padLng) {
    view.map.easeTo({ center: [lng, lat], duration: 600 });
  }
}

export function center() {
  if (!view) return null;
  const c = view.map.getCenter();
  return { lat: c.lat, lng: c.lng };
}
