// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// layers.js – NASA Mars Trek tile layers (basemaps + image overlays).
//
// Every layer ID, file format and max zoom below was read from that layer's
// WMTSCapabilities.xml, e.g.
// https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0/WMTSCapabilities.xml
// Regional layers also get `bounds`, so Leaflet doesn't request tiles
// outside the area the dataset covers (which would just return errors).

import L from 'leaflet';

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';

// Build a Leaflet tile layer for one Mars Trek product.
function trekLayer(id, { ext = 'png', maxNativeZoom, bounds, attribution, opacity = 1 }) {
  return L.tileLayer(`${TREK}/${id}/1.0.0/default/default028mm/{z}/{y}/{x}.${ext}`, {
    tileSize: 256,
    maxNativeZoom, // deepest zoom that really has tiles; Leaflet upscales beyond it
    maxZoom: 18,
    bounds: bounds ? L.latLngBounds(bounds) : undefined,
    attribution,
    opacity,
    noWrap: true,
  });
}

// --- The products we use (all checked against their capabilities XML) ---

// MGS MOLA colour hillshade: global elevation, ~463 m/pixel, zoom 0–7
const molaColour = () =>
  trekLayer('Mars_MGS_MOLA_ClrShade_merge_global_463m', {
    ext: 'jpg',
    maxNativeZoom: 7,
    attribution: 'MGS MOLA colour hillshade (NASA/JPL/GSFC) via NASA Mars Trek',
  });

// MGS MOLA + ESA Mars Express HRSC blended colour hillshade, ~200 m/pixel, zoom 0–8.
// HRSC is a camera on the European Space Agency's Mars Express orbiter (partner data).
const molaHrscColour = () =>
  trekLayer('Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw', {
    ext: 'jpg',
    maxNativeZoom: 8,
    attribution: 'MGS MOLA + ESA Mars Express HRSC blend (NASA/ESA/DLR/FU Berlin) via NASA Mars Trek',
  });

// Viking MDIM 2.1 colour mosaic: global, ~232 m/pixel, zoom 0–7.
// Used only as a background so the area outside the CTX mosaic isn't blank.
const vikingColour = () =>
  trekLayer('Mars_Viking_MDIM21_ClrMosaic_global_232m', {
    ext: 'jpg',
    maxNativeZoom: 7,
    attribution: 'Viking MDIM 2.1 (NASA/USGS) via NASA Mars Trek',
  });

// MRO CTX mosaic of the Jezero region, ~6 m/pixel, zoom 0–12
const ctxJezero = () =>
  trekLayer('Jezero_CTX_BlockAdj_dd', {
    maxNativeZoom: 12,
    bounds: [[15.9058484, 75.1537692], [19.4453003, 78.8717121]],
    attribution: 'MRO CTX Jezero mosaic (NASA/JPL/MSSS) via NASA Mars Trek',
  });

// Mars Odyssey THEMIS infrared, global ±65° latitude, ~100 m/pixel, zoom 0–9.
// Daytime IR: bright = warm (sun-facing slopes). Night-time IR: bright = holds
// heat (rocky/bedrock surfaces), dark = loose sand/dust.
const themisDay = () =>
  trekLayer('THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', {
    maxNativeZoom: 9,
    bounds: [[-65, -180], [65, 180]],
    attribution: 'Mars Odyssey THEMIS Day IR (NASA/JPL/ASU) via NASA Mars Trek',
  });
const themisNight = () =>
  trekLayer('THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', {
    maxNativeZoom: 9,
    bounds: [[-65, -180], [65, 180]],
    attribution: 'Mars Odyssey THEMIS Night IR (NASA/JPL/ASU) via NASA Mars Trek',
  });

// MRO HiRISE controlled orthomosaic of Jezero, 25 cm/pixel, zoom 0–17.
// Only covers the central crater (landing site, delta, Séítah).
export const HIRISE_BOUNDS = [[18.3067994, 77.2229331], [18.669315, 77.583964]];
const hiriseJezero = () =>
  trekLayer('JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', {
    maxNativeZoom: 17,
    bounds: HIRISE_BOUNDS,
    attribution: 'MRO HiRISE Jezero orthomosaic (NASA/JPL/UArizona) via NASA Mars Trek',
  });

// --- Public helpers ---

// Basemaps: only one can be shown at a time (radio buttons).
// A basemap can be several stacked tile layers (L.layerGroup).
export function createBasemaps() {
  return {
    'CTX imagery (MRO, ~6 m)': L.layerGroup([vikingColour(), ctxJezero()]),
    'MOLA colour elevation (MGS)': molaColour(),
    'MOLA + HRSC elevation (MGS + ESA Mars Express)': molaHrscColour(),
    'THEMIS day infrared (Odyssey)': themisDay(),
    'THEMIS night infrared (Odyssey)': themisNight(),
  };
}

// Image overlays that can be switched on top of any basemap.
export function createImageOverlays() {
  return {
    'HiRISE 25 cm mosaic (MRO)': hiriseJezero(),
  };
}

// ---------------------------------------------------------------------------
// GeoJSON data layers (our own files in /public/data)
// ---------------------------------------------------------------------------

const DATA = `${import.meta.env.BASE_URL}data`;

export async function loadJson(name) {
  const res = await fetch(`${DATA}/${name}`);
  if (!res.ok) throw new Error(`Could not load ${name}`);
  return res.json();
}

// Perseverance (Mars 2020) traverse: every drive is a line; the popup shows its sol.
// The last waypoint is shown as the rover's most recent known position.
export async function createRoverLayer() {
  const [traverse, wp] = await Promise.all([
    loadJson('perseverance_traverse.geojson'),
    loadJson('perseverance_waypoints.json'),
  ]);

  const lines = L.geoJSON(traverse, {
    style: { color: '#4fc3f7', weight: 2.5, opacity: 0.9 },
    onEachFeature: (f, layer) =>
      layer.bindTooltip(`Perseverance drive, sol ${f.properties.sol}`, { sticky: true }),
  });

  const first = wp.waypoints[0];
  const last = wp.waypoints[wp.waypoints.length - 1];
  const landing = L.circleMarker([first.lat, first.lon], {
    radius: 6, color: '#fff', weight: 2, fillColor: '#4fc3f7', fillOpacity: 1,
  }).bindPopup(
    `<h3>Octavia E. Butler Landing site</h3>Perseverance landed here on 18 Feb 2021.` +
    `<div class="src">Position: Mars 2020 waypoint feed (NASA/JPL-Caltech)</div>`
  );
  const now = L.circleMarker([last.lat, last.lon], {
    radius: 7, color: '#fff', weight: 2, fillColor: '#ff7043', fillOpacity: 1,
  }).bindPopup(
    `<h3>Perseverance – latest position in our snapshot</h3>` +
    `Sol ${last.sol}, ${last.km} km driven, elevation ${Math.round(last.elev)} m.` +
    `<div class="src">Mars 2020 waypoint feed (NASA/JPL-Caltech)</div>`
  );

  return { layer: L.layerGroup([lines, landing, now]), waypoints: wp.waypoints };
}

// Turn plain URLs inside a text into clickable links
const linkify = (text) =>
  text.replace(/https?:\/\/[^\s;]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '').slice(0, 45)}…</a>`);

// Perseverance's own photos from the sol it stood here – "what you'll see when you arrive"
function povHtml(p) {
  if (!p.pov_images || !p.pov_images.length) return '';
  return `<div style="margin-top:6px"><b>What you'll see here</b> (Perseverance, sol ${p.sol}):</div>
    <div class="pov">${p.pov_images.map((im) =>
      `<a href="${im.large}" target="_blank" rel="noopener" title="${im.camera}, sol ${im.sol}">
         <img src="${im.thumb}" alt="Perseverance ${im.camera} image, sol ${im.sol}" loading="lazy"></a>`).join('')}</div>
    <div class="src">Raw images: NASA/JPL-Caltech (Navcam, Mastcam-Z: ASU)</div>`;
}

// Science targets (★): popup with why it matters, sources and HiRISE link.
// Returns the layer plus a simple list used by the route planner.
export async function createScienceLayer() {
  const gj = await loadJson('science_targets.geojson');
  const list = [];
  const layer = L.geoJSON(gj, {
    pointToLayer: (f, latlng) => {
      list.push({ name: f.properties.name, latlng });
      return L.marker(latlng, {
        icon: L.divIcon({ className: 'sci-icon', html: '★', iconSize: [26, 26] }),
        title: f.properties.name,
      });
    },
    onEachFeature: (f, layer) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      layer.bindPopup(`
        <h3>★ ${p.name}</h3>
        <div>${p.why}</div>
        <div style="margin-top:6px"><b>Mission / instrument:</b> ${p.mission}</div>
        <div><b>Elevation:</b> ${p.elev_m} m</div>
        ${povHtml(p)}
        <div style="margin-top:6px">
          <a href="${p.hirise_url}" target="_blank" rel="noopener">HiRISE ${p.hirise_id}</a>
          – ${p.hirise_title} (image centre ${p.hirise_km} km away)<br>
          <a href="#" class="zoom-hirise" data-lat="${lat}" data-lng="${lng}">🔍 Zoom in on the 25 cm HiRISE mosaic</a>
        </div>
        <div class="src">Location: ${p.position}.<br>Sources: ${linkify(p.source)}</div>`,
        { maxWidth: 320 });
    },
  });
  return { layer, list };
}

// Perseverance sample sites (small tube markers)
export async function createSamplesLayer() {
  const gj = await loadJson('perseverance_samples.geojson');
  return L.geoJSON(gj, {
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 5, color: '#1a0e08', weight: 1.5,
        fillColor: f.properties.depot ? '#ffd54f' : '#ab47bc', fillOpacity: 1,
      }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      layer.bindPopup(`
        <h3>Sample ${p.n}: ${p.name}</h3>
        <div>${p.type}${p.rock ? ` (${p.rock})` : ''} · ${p.location} · target "${p.feature}"</div>
        <div>Campaign: ${p.campaign}. Sealed ${p.date_sealed ? `${p.date_sealed} (sol ${p.sol})` : 'TBD'}.</div>
        ${p.depot ? '<div>🟡 This tube was left at the Three Forks sample depot.</div>' : ''}
        <div class="src">${p.position_note}${p.sol_note ? '. ' + p.sol_note : ''}.<br>
        Source: <a href="https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/" target="_blank" rel="noopener">NASA Mars Rock Samples</a></div>`);
    },
  });
}

// Labelled steep-slope zones found automatically in the DTM (scripts/make_terrain_grid.py)
export async function createHazardZonesLayer() {
  const gj = await loadJson('hazard_zones.geojson');
  return L.geoJSON(gj, {
    pointToLayer: (f, latlng) =>
      L.marker(latlng, {
        icon: L.divIcon({ className: 'haz-icon', html: '⚠', iconSize: [22, 22] }),
      }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      layer.bindTooltip(`${p.label}: slopes up to ${p.max_slope_deg}°, ~${p.area_km2} km²`);
      layer.bindPopup(`<h3>⚠ ${p.label}</h3>
        Connected area of terrain steeper than 25° (scarps, crater walls, butte flanks).
        Max slope ${p.max_slope_deg}°, area ≈ ${p.area_km2} km². Do not route a walk through it.
        <div class="src">Computed from the MRO CTX Jezero DTM (20 m). Loose sand is not
        detected by slope – compare with the THEMIS night-IR basemap (dark = low thermal inertia, i.e. loose sand/dust).</div>`);
    },
  });
}

// ---------------------------------------------------------------------------
// MRO CRISM mineral maps (spectral data) – scripts/make_crism_layers.py
// ---------------------------------------------------------------------------
// Colour keys are NASA Mars Trek's descriptions of the CRISM browse products
// (Viviano-Beck et al. 2014, doi:10.1002/2014JE004627).
export const CRISM_PRODUCTS = {
  PHY: {
    name: 'CRISM clays & hydrated minerals (MRO)',
    key: [
      ['#e0306a', 'Red / magenta: Fe/Mg clays (Fe/Mg-OH minerals)'],
      ['#3ad1c6', 'Green / cyan: Al clays or hydrated silica'],
      ['#4a6cff', 'Blue: other hydrated minerals (sulfates, carbonate…)'],
    ],
  },
  CAR: {
    name: 'CRISM carbonates (MRO)',
    key: [
      ['#e6e6b0', 'Bluish or yellowish white: carbonate'],
      ['#e0306a', 'Red / magenta: Fe/Mg clays'],
      ['#4a6cff', 'Blue: other hydrated minerals'],
    ],
  },
  MAF: {
    name: 'CRISM olivine & pyroxene (MRO)',
    key: [
      ['#e0483e', 'Red: olivine (or Fe-clay)'],
      ['#3ad1c6', 'Green / cyan: low-Ca pyroxene'],
      ['#7a5cff', 'Blue / magenta: high-Ca pyroxene'],
    ],
  },
};

// One layer per mineral product; each layer holds that product's image from
// every CRISM observation over Jezero, placed with its exact lat/lon bounds.
export async function createCrismLayers(map) {
  // A separate pane between the basemap tiles (z 200) and our overlays (z 400).
  // "screen" blending makes the black "no detection" pixels see-through, so
  // only the coloured mineral signal shows on top of the imagery.
  const pane = map.createPane('crism');
  pane.style.zIndex = 350;
  pane.style.mixBlendMode = 'screen';

  const idx = await loadJson('crism_index.json');
  // Draw lower-resolution HRL images first so sharper FRT images sit on top
  const images = [...idx.images].sort((a, b) => (a.obs.startsWith('HRL') ? -1 : 1) - (b.obs.startsWith('HRL') ? -1 : 1));

  const layers = {};
  for (const [code, info] of Object.entries(CRISM_PRODUCTS)) {
    const group = L.layerGroup(
      images
        .filter((im) => im.product === code)
        .map((im) => L.imageOverlay(`${DATA}/${im.file}`, im.bounds, {
          pane: 'crism',
          attribution: 'MRO CRISM MTRDR browse products (NASA/JHU-APL) via NASA PDS Geosciences Node',
        }))
    );
    group.crismCode = code;
    layers[info.name] = group;
  }
  return { layers, observations: [...new Set(images.map((im) => im.obs))] };
}

// Legend box (bottom-right) that shows the colour key of the CRISM layer(s) that are on
export function addCrismLegend(map, crism) {
  const Legend = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'crism-legend');
      div.hidden = true;
      return div;
    },
  });
  const ctl = new Legend().addTo(map);
  const div = ctl.getContainer();

  function refresh() {
    const on = Object.values(crism.layers).filter((l) => map.hasLayer(l));
    div.hidden = on.length === 0;
    div.innerHTML = on.map((l) => {
      const p = CRISM_PRODUCTS[l.crismCode];
      return `<b>${p.name}</b>` + p.key.map(([c, t]) =>
        `<div><span class="legend-swatch" style="background:${c}"></span>${t}</div>`).join('');
    }).join('<hr>') +
      `<div class="small">Dark = no detection. ${crism.observations.length} CRISM observations
       (${crism.observations.join(', ')}). Straight coloured lines are instrument artifacts.<br>
       Source: NASA PDS (CRISM MTRDR browse); colour keys: NASA Mars Trek.</div>`;
  }
  // layeradd/layerremove also catch layers switched on by code (e.g. the guided tour)
  map.on('layeradd layerremove', refresh);
  return refresh;
}
