// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// map.js – creates the Leaflet map in a Mars coordinate system.
//
// NASA Mars Trek serves "EQ" (equirectangular) tiles. We checked the
// WMTSCapabilities.xml of every layer we use:
//   - TopLeftCorner = (-180°, 90°)
//   - zoom 0 = 2 columns x 1 row of 256 px tiles (each tile = 180° x 180°)
//   - each zoom level doubles the number of rows and columns
//   - tile URL: .../1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}
// Leaflet's built-in L.CRS.EPSG4326 uses exactly this tile grid. The only
// thing we change is the planet radius, so distances and the scale bar use
// Mars (radius 3,396,190 m, the IAU Mars 2000 sphere) instead of Earth.

import L from 'leaflet';

export const MARS_RADIUS_M = 3396190;

// Same as EPSG4326, but with the Mars radius
export const MarsCRS = L.Util.extend({}, L.CRS.EPSG4326, {
  R: MARS_RADIUS_M,
});

// Jezero Crater, near the Perseverance landing site
export const JEZERO_CENTER = [18.445, 77.40];

export function createMap(elementId) {
  const map = L.map(elementId, {
    crs: MarsCRS,
    center: JEZERO_CENTER,
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: false,
  });

  // Scale bar (uses MarsCRS distance → correct for Mars)
  L.control.scale({ metric: true, imperial: false, maxWidth: 160 }).addTo(map);

  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>'
  );

  return map;
}

// Small box in the bottom-left corner that shows the mouse position.
// Mars uses planetocentric latitude and EAST-positive longitude (0–360°E
// is also common; we show −180…180 which Mars Trek also uses).
// `getExtraText(latlng)` lets other modules add info (e.g. elevation).
export function addCoordinateReadout(map, getExtraText = () => '') {
  const Readout = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      const div = L.DomUtil.create('div', 'coord-readout');
      div.textContent = 'Move the mouse over the map';
      return div;
    },
  });
  const control = new Readout().addTo(map);
  const div = control.getContainer();

  map.on('mousemove', (e) => {
    const { lat, lng } = e.latlng;
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lng >= 0 ? 'E' : 'W';
    const extra = getExtraText(e.latlng);
    div.textContent =
      `${Math.abs(lat).toFixed(4)}°${ns}  ${Math.abs(lng).toFixed(4)}°${ew}` +
      (extra ? `  ·  ${extra}` : '');
  });
  return control;
}
