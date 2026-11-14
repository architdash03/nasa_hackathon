// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// main.js – app entry point. Builds the map and wires all the pieces together.

import 'leaflet/dist/leaflet.css';
import './style.css';
import L from 'leaflet';

import { createMap, addCoordinateReadout } from './map.js';
import {
  createBasemaps, createImageOverlays, createRoverLayer,
  createScienceLayer, createSamplesLayer, createHazardZonesLayer, HIRISE_BOUNDS,
  createCrismLayers, addCrismLegend,
} from './layers.js';
import { loadTerrain, elevationAt, slopeAt, createSlopeHazardLayer } from './terrain.js';
import * as planner from './route.js';
import { initTour, initAbout } from './tour.js';
import { initSpaceWeather } from './spaceweather.js';

// 1. Map in Mars coordinates, centred on Jezero Crater
const map = createMap('map');

// 2. Basemaps (pick one) + overlays (switch on/off)
const basemaps = createBasemaps();
const overlays = createImageOverlays();
basemaps['CTX imagery (MRO, ~6 m)'].addTo(map);
const layerControl = L.control
  .layers(basemaps, overlays, { position: 'topleft', collapsed: true })
  .addTo(map);

// 3. Lat/lon (+ elevation and slope once the terrain grid has loaded)
addCoordinateReadout(map, (ll) => {
  const z = elevationAt(ll.lat, ll.lng);
  if (z === null) return '';
  return `elev ${Math.round(z)} m · slope ≤${slopeAt(ll.lat, ll.lng)}°`;
});

// 4. Load the data layers (they are files in /public/data)
async function loadDataLayers() {
  await loadTerrain();
  const slopeLayer = createSlopeHazardLayer();
  layerControl.addOverlay(slopeLayer, '⚠ Steep slopes (>15° / >25°)');
  slopeLayer.addTo(map);

  // MRO CRISM mineral maps (spectral data) – off by default, pick from the layer menu
  const crism = await createCrismLayers(map);
  for (const [name, layer] of Object.entries(crism.layers)) layerControl.addOverlay(layer, name);
  addCrismLegend(map, crism);

  const rover = await createRoverLayer();
  layerControl.addOverlay(rover.layer, 'Perseverance traverse (Mars 2020)');
  rover.layer.addTo(map);

  const samples = await createSamplesLayer();
  layerControl.addOverlay(samples, 'Perseverance sample sites (🟡 = at depot)');
  samples.addTo(map);

  const hazards = await createHazardZonesLayer();
  layerControl.addOverlay(hazards, '⚠ Labelled steep zones');
  hazards.addTo(map);

  const science = await createScienceLayer();
  layerControl.addOverlay(science.layer, '★ Science targets (CRISM + Mars 2020)');
  science.layer.addTo(map);

  // The route planner needs the terrain grid, so start it after loading
  planner.initRoutePlanner(map, document.getElementById('panel'));
  planner.setScienceTargets(science.list);

  // Live space weather (NASA DONKI) – shown under the route results and
  // used by the radiation item of the survival checklist
  const sw = document.createElement('div');
  sw.id = 'spaceweather';
  document.getElementById('route-results').after(sw);
  initSpaceWeather(sw, planner.setSpaceWeather);

  // Guided demo tour: button in the panel; open the page with ?tour to start it right away
  const tour = initTour(map, {
    science, slopeLayer, clayLayer: crism.layers['CRISM clays & hydrated minerals (MRO)'],
  });
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = '▶ Guided tour';
  btn.addEventListener('click', tour.start);
  document.querySelector('#panel .btn-row').appendChild(btn);
  if (new URLSearchParams(location.search).has('tour')) tour.start();
}

initAbout();

// "Zoom in on HiRISE" links inside popups: turn on the HiRISE layer and zoom
document.addEventListener('click', (e) => {
  const a = e.target.closest('.zoom-hirise');
  if (!a) return;
  e.preventDefault();
  const ll = L.latLng(+a.dataset.lat, +a.dataset.lng);
  const hirise = overlays['HiRISE 25 cm mosaic (MRO)'];
  if (L.latLngBounds(HIRISE_BOUNDS).contains(ll)) hirise.addTo(map);
  map.setView(ll, 17);
});
loadDataLayers().catch((err) => console.error('Data layer failed to load:', err));

// 5. Panel show/hide button (useful on phones)
document.getElementById('panel-toggle').addEventListener('click', () => {
  document.body.classList.toggle('panel-hidden');
  // Leaflet must re-measure the map after its container changes size
  setTimeout(() => map.invalidateSize(), 250);
});

// Expose for debugging in the browser console
window.marsMap = map;
window.L = L;
window.planner = planner;
