// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// route.js – the Marswalk route planner (the core feature).
//
// How it works:
//  1. In "draw" mode, every click on the map adds a route point.
//  2. The route is sampled every ~20 m. At each sample we look up elevation
//     and terrain slope from the CTX DTM grid (terrain.js).
//  3. From those samples we compute distance, the elevation profile, the
//     steepest slope, hazard crossings, walking time, oxygen use and
//     radiation dose, and show them in the side panel.
//
// All model numbers live in ASSUMPTIONS below so they are easy to explain
// (and to change) during judging. The README lists the sources.

import L from 'leaflet';
import {
  Chart, LineController, LineElement, PointElement, LinearScale, Filler, Tooltip,
} from 'chart.js';
import { elevationAt, slopeAt, SLOPE_CAUTION, SLOPE_DANGER } from './terrain.js';
import { findSafePath } from './pathfind.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip);

// ---------------------------------------------------------------------------
// Model assumptions (shown in the UI as "estimate")
// ---------------------------------------------------------------------------
export const ASSUMPTIONS = {
  // NASA EVA-EXP-0075 (Exploration EVA ConOps, 2020): "~2 km/hr walking pace on
  // relatively level regolith; does not account for slope or obstacles"
  flatSpeedKmh: 2.0,
  // Same document: EVAs "of up to 8 hours in duration (6±2 hours)"
  suitOxygenHours: 8,
  reserveFraction: 0.25,     // OUR choice: keep 25% of the oxygen as safety reserve
  minutesPerScienceStop: 20, // OUR choice: time spent at each science stop
  scienceStopRadiusM: 150,   // a stop counts as "visited" if the route passes this close
  // Curiosity RAD at Gale crater: 0.64 ± 0.12 mSv/day dose equivalent
  // (Hassler et al. 2014, Science, doi:10.1126/science.1244797). Jezero is
  // assumed similar (both are low-lying sites near the equator).
  radiationMsvPerDay: 0.64,
  careerLimitMsv: 600,       // NASA-STD-3001 career effective-dose limit
  stepM: 20,                 // route sampling distance
};

// Walking speed (km/h) on a path with gradient `grade` (rise/run, uphill > 0).
// Shape from Tobler's hiking function (fastest on a gentle downhill, slower on
// steep up- or downhill), scaled so flat ground = ASSUMPTIONS.flatSpeedKmh.
export function walkingSpeedKmh(grade) {
  const tobler = (g) => Math.exp(-3.5 * Math.abs(g + 0.05));
  return ASSUMPTIONS.flatSpeedKmh * (tobler(grade) / tobler(0));
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let map;
let points = [];        // L.LatLng[] – the clicked route points
let markers = [];       // draggable markers for each point
let line;               // L.Polyline of the route
let hoverMarker;        // marker that follows the elevation-chart hover
let hazardLines;        // red/yellow pieces of the route drawn over steep terrain
let chart;              // Chart.js instance
let drawing = false;
let roundTrip = true;
let scienceTargets = []; // [{name, latlng}] – set by main.js
let samples = [];       // last analysis samples (for chart hover)
let spaceWeather = { level: 'unknown', soon: [] }; // set by spaceweather.js

// Called by main.js when the live space-weather check finishes
export function setSpaceWeather(status) {
  spaceWeather = status;
  update();
}

// Called by main.js once the science layer has loaded
export function setScienceTargets(list) {
  scienceTargets = list;
  update();
}

// ---------------------------------------------------------------------------
// Public: set up the planner
// ---------------------------------------------------------------------------
export function initRoutePlanner(leafletMap, panelEl) {
  map = leafletMap;
  panelEl.innerHTML = panelHtml();

  line = L.polyline([], { color: '#ffffff', weight: 4, opacity: 0.95, dashArray: '8 6' }).addTo(map);
  hazardLines = L.layerGroup().addTo(map);
  hoverMarker = L.circleMarker([0, 0], {
    radius: 7, color: '#000', weight: 2, fillColor: '#fff', fillOpacity: 1,
  });

  // Buttons
  const $ = (id) => document.getElementById(id);
  $('btn-draw').addEventListener('click', () => setDrawing(!drawing));
  $('btn-undo').addEventListener('click', () => {
    points.pop();
    redraw();
  });
  $('btn-clear').addEventListener('click', () => setRoute([]));
  $('btn-safer').addEventListener('click', () => makeSafer());
  $('btn-preset').addEventListener('click', () => loadRecommendedRoute());
  // Pace slider: a suited astronaut carrying tools/samples walks slower.
  // NASA's 2 km/h planning pace is the default; the user can lower it.
  $('rng-pace').addEventListener('input', (e) => {
    ASSUMPTIONS.flatSpeedKmh = Number(e.target.value);
    $('pace-val').textContent = ASSUMPTIONS.flatSpeedKmh.toFixed(1);
    update();
  });
  $('chk-roundtrip').addEventListener('change', (e) => {
    roundTrip = e.target.checked;
    update();
  });

  // Map clicks add points while in draw mode
  map.on('click', (e) => {
    if (!drawing) return;
    points.push(e.latlng);
    redraw();
  });

  createChart();
  update();
}

// Replace every straight leg of the route with a safe path from the A* search.
// The user's own points become "via" points that the new route still passes.
export function makeSafer() {
  if (points.length < 2) return message('Draw a route with at least 2 points first.');
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const leg = findSafePath(points[i], points[i + 1]);
    if (!leg) return message(`No safe path found for leg ${i + 1} → ${i + 2} (outside the DTM or walled in by steep terrain).`);
    out.push(...(i === 0 ? leg : leg.slice(1)));
  }
  setRoute(out);
  message('Route re-planned around terrain steeper than 15° where possible (A* search on the DTM slope grid).');
}

// Example route: from the landing site to two science stops, re-planned safely
export function loadRecommendedRoute() {
  const byName = (part) => scienceTargets.find((t) => t.name.includes(part))?.latlng;
  const stops = [byName('Crater floor'), byName('Séítah'), byName('Delta front')].filter(Boolean);
  if (stops.length < 3) return message('Science targets not loaded yet.');
  setRoute(stops);
  makeSafer();
  map.fitBounds(line.getBounds(), { padding: [40, 40] });
  message('Recommended route: landing-site crater floor → Séítah olivine rocks → delta front clays, avoiding steep slopes.');
}

function message(text) {
  const el = document.getElementById('route-msg');
  if (el) el.textContent = text;
}

// Replace the whole route (used by Clear and by the preset route button)
export function setRoute(latlngs) {
  points = latlngs.map((p) => L.latLng(p));
  redraw();
}

export function setDrawing(on) {
  drawing = on;
  document.getElementById('btn-draw').classList.toggle('active', on);
  document.getElementById('btn-draw').textContent = on ? '✓ Done drawing' : '✏️ Draw route';
  map.getContainer().style.cursor = on ? 'crosshair' : '';
  // don't open feature popups by accident while drawing
  map.getContainer().classList.toggle('drawing', on);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function redraw() {
  markers.forEach((m) => m.remove());
  markers = points.map((p, i) => {
    const m = L.marker(p, {
      draggable: true,
      icon: L.divIcon({
        className: 'route-pt',
        html: i === 0 ? 'S' : String(i),
        iconSize: [22, 22],
      }),
    }).addTo(map);
    // dragging a point moves it and re-runs the analysis
    m.on('drag', (e) => {
      points[i] = e.target.getLatLng();
      line.setLatLngs(points);
    });
    m.on('dragend', update);
    return m;
  });
  line.setLatLngs(points);
  update();
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

// Walk along the route and create a sample every ~stepM metres.
function sampleRoute(pts) {
  const out = [];
  let distM = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const segM = map.distance(a, b); // uses the Mars radius (see map.js)
    const n = Math.max(1, Math.ceil(segM / ASSUMPTIONS.stepM));
    for (let k = 0; k < n; k++) {
      if (i > 0 && k === 0) continue; // avoid duplicating the shared corner point
      const t = k / n;
      out.push(makeSample(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t, distM + segM * t));
    }
    distM += segM;
  }
  const last = pts[pts.length - 1];
  out.push(makeSample(last.lat, last.lng, distM));
  return out;
}

function makeSample(lat, lng, distM) {
  return { lat, lng, distM, elev: elevationAt(lat, lng), slope: slopeAt(lat, lng) };
}

function analyse() {
  if (points.length < 2) return null;
  samples = sampleRoute(points);

  let walkHours = 0, climbM = 0, descentM = 0, maxSlope = 0;
  let cautionM = 0, dangerM = 0, noDataM = 0;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const d = b.distM - a.distM;
    if (a.elev === null || b.elev === null) {
      noDataM += d;
      walkHours += d / 1000 / ASSUMPTIONS.flatSpeedKmh;
      continue;
    }
    const dz = b.elev - a.elev;
    if (dz > 0) climbM += dz; else descentM -= dz;
    // one-way time; the return trip uses the opposite gradient
    walkHours += d / 1000 / walkingSpeedKmh(dz / d);
    if (roundTrip) walkHours += d / 1000 / walkingSpeedKmh(-dz / d);

    const s = b.slope ?? 0;
    maxSlope = Math.max(maxSlope, s);
    if (s > SLOPE_DANGER) dangerM += d;
    else if (s > SLOPE_CAUTION) cautionM += d;
  }
  if (roundTrip && noDataM > 0) walkHours += noDataM / 1000 / ASSUMPTIONS.flatSpeedKmh;

  const oneWayM = samples[samples.length - 1].distM;
  const totalM = roundTrip ? oneWayM * 2 : oneWayM;

  // Science stops the route passes close to
  const visited = scienceTargets.filter((t) =>
    samples.some((s) => map.distance([s.lat, s.lng], t.latlng) <= ASSUMPTIONS.scienceStopRadiusM)
  );
  const stopHours = (visited.length * ASSUMPTIONS.minutesPerScienceStop) / 60;
  const evaHours = walkHours + stopHours;

  const usable = ASSUMPTIONS.suitOxygenHours * (1 - ASSUMPTIONS.reserveFraction);
  const oxygen = evaHours <= usable ? 'ok' : evaHours <= ASSUMPTIONS.suitOxygenHours ? 'warn' : 'bad';
  const slopeStatus = dangerM > 0 ? 'bad' : cautionM > 0 ? 'warn' : 'ok';
  const doseMsv = (ASSUMPTIONS.radiationMsvPerDay * evaHours) / 24;

  return {
    oneWayM, totalM, walkHours, stopHours, evaHours, usable, oxygen,
    climbM, descentM, maxSlope, cautionM, dangerM, noDataM, slopeStatus,
    doseMsv, visited,
  };
}

// ---------------------------------------------------------------------------
// Panel rendering
// ---------------------------------------------------------------------------
const fmtKm = (m) => (m / 1000).toFixed(2) + ' km';
const fmtH = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`;
const ICON = { ok: '✓', warn: '!', bad: '✗' };
const EST = '<span class="estimate-tag">estimate</span>';

function update() {
  const r = analyse();
  const out = document.getElementById('route-results');
  if (!out) return;
  if (points.length < 2) message('');

  if (!r) {
    out.innerHTML = `<p>Click <b>✏️ Draw route</b>, then click on the map to add points.
      Drag a numbered point to move it.</p>`;
    updateChart([]);
    hazardLines.clearLayers();
    return;
  }

  const warnings = [];
  if (r.dangerM > 0) warnings.push(`Crosses ${Math.round(r.dangerM)} m of terrain steeper than ${SLOPE_DANGER}° – re-route!`);
  if (r.cautionM > 0) warnings.push(`${Math.round(r.cautionM)} m of terrain between ${SLOPE_CAUTION}° and ${SLOPE_DANGER}° – walk with care.`);
  if (r.noDataM > 0) warnings.push(`${Math.round(r.noDataM)} m is outside the DTM: no slope data, treated as flat.`);
  if (r.oxygen !== 'ok') warnings.push(`EVA time eats into the ${Math.round(ASSUMPTIONS.reserveFraction * 100)}% oxygen reserve.`);

  // Radiation status follows the live space-weather check (spaceweather.js)
  const radStatus = spaceWeather.level === 'alert' ? 'warn' : 'ok';
  const radNote = {
    alert: '<b class="warn">Space-weather alert: a CME is predicted to reach Mars – postpone or shorten the EVA.</b>',
    quiet: 'Live check: no CME predicted to reach Mars in the next 3 days (NASA DONKI).',
    unknown: 'Live space-weather check unavailable – check NASA DONKI before going out.',
  }[spaceWeather.level];

  out.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="label">Distance ${roundTrip ? '(there & back)' : '(one way)'}</div>
        <div class="value">${fmtKm(r.totalM)}</div></div>
      <div class="stat"><div class="label">EVA time ${EST}</div>
        <div class="value ${r.oxygen}">${fmtH(r.evaHours)}</div></div>
      <div class="stat"><div class="label">Climb / descent</div>
        <div class="value">+${Math.round(r.climbM)} / −${Math.round(r.descentM)} m</div></div>
      <div class="stat"><div class="label">Max terrain slope</div>
        <div class="value ${r.slopeStatus}">${r.maxSlope}°</div></div>
    </div>
    ${warnings.length ? `<ul class="warnings">${warnings.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}

    <h2>Survival checklist</h2>
    <ul class="checklist">
      <li><span class="icon ${r.oxygen}">${ICON[r.oxygen]}</span><div>
        <b>Oxygen</b> ${EST}<br><span class="small">${fmtH(r.evaHours)} needed
        (${fmtH(r.walkHours)} walking + ${fmtH(r.stopHours)} at stops) vs ${fmtH(r.usable)} usable
        of an ${ASSUMPTIONS.suitOxygenHours} h suit.</span></div></li>
      <li><span class="icon ${r.slopeStatus}">${ICON[r.slopeStatus]}</span><div>
        <b>Slope safety</b><br><span class="small">Steepest terrain on route: ${r.maxSlope}°
        (caution &gt;${SLOPE_CAUTION}°, danger &gt;${SLOPE_DANGER}°).</span></div></li>
      <li><span class="icon ${radStatus}">${ICON[radStatus]}</span><div>
        <b>Radiation</b> ${EST}<br><span class="small">≈ ${r.doseMsv.toFixed(2)} mSv for this EVA,
        using Curiosity RAD's quiet-Sun surface rate of ${ASSUMPTIONS.radiationMsvPerDay} mSv/day
        (${((r.doseMsv / ASSUMPTIONS.careerLimitMsv) * 100).toFixed(3)}% of NASA's ${ASSUMPTIONS.careerLimitMsv} mSv career limit).
        ${radNote}</span></div></li>
      <li><span class="icon ${r.visited.length ? 'ok' : 'warn'}">${r.visited.length ? '✓' : '–'}</span><div>
        <b>Science stops visited: ${r.visited.length}</b><br><span class="small">
        ${r.visited.length ? r.visited.map((t) => t.name).join(', ') : `Pass within ${ASSUMPTIONS.scienceStopRadiusM} m of a ★ target to visit it.`}
        </span></div></li>
    </ul>`;

  updateChart(samples);
  drawHazardPieces(samples);
}

// Paint the parts of the route that cross steep terrain in yellow / red
function drawHazardPieces(list) {
  hazardLines.clearLayers();
  for (let i = 1; i < list.length; i++) {
    const s = list[i].slope ?? 0;
    if (s <= SLOPE_CAUTION) continue;
    L.polyline([[list[i - 1].lat, list[i - 1].lng], [list[i].lat, list[i].lng]], {
      color: s > SLOPE_DANGER ? '#e0483e' : '#e8b931', weight: 7, opacity: 0.9, interactive: false,
    }).addTo(hazardLines);
  }
}

function panelHtml() {
  return `
    <h2>Plan your Marswalk</h2>
    <div class="btn-row">
      <button class="btn primary" id="btn-draw">✏️ Draw route</button>
      <button class="btn" id="btn-undo">↶ Undo</button>
      <button class="btn" id="btn-clear">✕ Clear</button>
    </div>
    <div class="btn-row">
      <button class="btn" id="btn-safer" title="Re-route each leg around steep terrain">🛡 Make route safer</button>
      <button class="btn" id="btn-preset" title="Load an example safe route">⭐ Recommended route</button>
    </div>
    <div id="route-msg" class="small"></div>
    <label class="small"><input type="checkbox" id="chk-roundtrip" checked> Round trip (walk back the same way)</label>
    <label class="small pace">Flat-ground pace: <b><span id="pace-val">2.0</span> km/h</b>
      <input type="range" id="rng-pace" min="1" max="3" step="0.1" value="2">
      <span>NASA planning pace is ~2 km/h on level ground; lower it for heavy tools or sample bags (your assumption).</span></label>
    <div id="route-results"></div>
    <h2>Elevation profile</h2>
    <div class="chart-box"><canvas id="profile"></canvas></div>
    <p class="small">Hover the chart to see the spot on the map. Elevation from the MRO CTX DTM (m above the Mars areoid).</p>`;
}

// ---------------------------------------------------------------------------
// Elevation chart (Chart.js)
// ---------------------------------------------------------------------------
function slopeColour(s) {
  if (s > SLOPE_DANGER) return '#e0483e';
  if (s > SLOPE_CAUTION) return '#e8b931';
  return '#e2703a';
}

function createChart() {
  const ctx = document.getElementById('profile');
  chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [{
      data: [],
      borderWidth: 2,
      pointRadius: 0,
      fill: true,
      backgroundColor: 'rgba(226,112,58,0.15)',
      // colour each piece of the line by the terrain slope there
      segment: { borderColor: (c) => slopeColour(samples[c.p1DataIndex]?.slope ?? 0) },
    }] },
    options: {
      animation: false,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'distance from start, one way (km)', color: '#b29d8f' },
             ticks: { color: '#b29d8f' }, grid: { color: '#3d2f27' } },
        y: { title: { display: true, text: 'elevation (m)', color: '#b29d8f' },
             ticks: { color: '#b29d8f' }, grid: { color: '#3d2f27' } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].parsed.x.toFixed(2)} km`,
            label: (item) => {
              const s = samples[item.dataIndex];
              return `${Math.round(s.elev)} m · terrain slope ≤${s.slope}°`;
            },
          },
        },
      },
      // Hovering the chart moves a marker on the map
      onHover: (evt, elements) => {
        if (elements.length) {
          const s = samples[elements[0].index];
          hoverMarker.setLatLng([s.lat, s.lng]).addTo(map);
        } else {
          hoverMarker.remove();
        }
      },
    },
  });
  ctx.addEventListener('mouseleave', () => hoverMarker.remove());
}

function updateChart(list) {
  chart.data.datasets[0].data = list
    .filter((s) => s.elev !== null)
    .map((s) => ({ x: s.distM / 1000, y: s.elev }));
  // keep `samples` index-aligned with the chart data
  samples = list.filter((s) => s.elev !== null);
  // x axis ends exactly at the end of the route
  chart.options.scales.x.min = 0;
  chart.options.scales.x.max = samples.length ? samples[samples.length - 1].distM / 1000 : 1;
  chart.update();
}
