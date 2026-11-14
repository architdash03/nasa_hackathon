// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// tour.js – a 4-step guided demo for judges, plus the "About & sources" dialog.

import { loadRecommendedRoute, setRoute } from './route.js';

// ---------------------------------------------------------------------------
// Guided tour
// ---------------------------------------------------------------------------
export function initTour(map, { science, slopeLayer, clayLayer }) {
  const steps = [
    {
      title: '1 · Welcome to Jezero Crater',
      text: 'An ancient lake on Mars and home of the Perseverance rover. The basemap is MRO CTX imagery; ' +
        'use the layer button (top-left) for MOLA elevation, THEMIS thermal and 25 cm HiRISE views.',
      run: () => { setRoute([]); clayLayer.remove(); map.flyTo([18.455, 77.40], 13); },
    },
    {
      title: '2 · Science targets',
      text: 'The glowing colours are MRO CRISM mineral maps: red/magenta = Fe/Mg clays, which form in water. ' +
        '★ = science targets where Perseverance collected samples; each popup shows the rover’s own photos from that spot.',
      run: () => {
        if (map.hasLayer(slopeLayer)) slopeLayer.remove();
        clayLayer.addTo(map);
        map.flyTo([18.47, 77.39], 13);
        // open the "Delta front" popup after the flight
        setTimeout(() => science.layer.eachLayer((l) => {
          if (l.feature.properties.name.startsWith('Delta front')) l.openPopup();
        }), 1300);
      },
    },
    {
      title: '3 · Hazards',
      text: 'Yellow cells have slopes over 15°, red over 25°, computed from the 20 m CTX elevation model. ' +
        '⚠ markers label the biggest steep zones: scarps of the delta front and crater walls.',
      run: () => {
        map.closePopup();
        clayLayer.remove();
        if (!map.hasLayer(slopeLayer)) slopeLayer.addTo(map);
        map.flyTo([18.47, 77.37], 13);
      },
    },
    {
      title: '4 · Plan a safe Marswalk',
      text: 'The recommended route visits 4 science stops while avoiding steep terrain. Check the survival checklist ' +
        '(oxygen, slope, radiation + live space weather) and hover the elevation profile. Then draw your own route!',
      run: () => loadRecommendedRoute(),
    },
  ];

  const box = document.createElement('div');
  box.id = 'tour';
  box.innerHTML = `
    <div class="tour-title"></div>
    <div class="tour-text"></div>
    <div class="btn-row">
      <button class="btn" data-act="prev">◀ Back</button>
      <button class="btn primary" data-act="next">Next ▶</button>
      <button class="btn" data-act="close">✕</button>
    </div>`;
  box.hidden = true;
  document.getElementById('layout').appendChild(box);

  let i = 0;
  function show(k) {
    i = Math.max(0, Math.min(steps.length - 1, k));
    box.querySelector('.tour-title').textContent = steps[i].title;
    box.querySelector('.tour-text').textContent = steps[i].text;
    box.querySelector('[data-act=prev]').disabled = i === 0;
    box.querySelector('[data-act=next]').textContent = i === steps.length - 1 ? 'Finish ✓' : 'Next ▶';
    box.hidden = false;
    steps[i].run();
  }
  box.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (act === 'prev') show(i - 1);
    if (act === 'next') (i === steps.length - 1 ? (box.hidden = true) : show(i + 1));
    if (act === 'close') box.hidden = true;
  });
  return { start: () => show(0) };
}

// ---------------------------------------------------------------------------
// About & sources dialog (same list as the README "NASA Data Used" section)
// ---------------------------------------------------------------------------
const SOURCES = [
  ['NASA Mars Trek (JPL) – tile service for all basemaps', 'https://trek.nasa.gov/mars/'],
  ['MRO CTX Jezero mosaic (Mars Trek layer Jezero_CTX_BlockAdj_dd)', 'https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0/WMTSCapabilities.xml'],
  ['MRO HiRISE Jezero 25 cm orthomosaic (Mars 2020 team, via Mars Trek)', 'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml'],
  ['MGS MOLA colour hillshade (Mars Trek)', 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml'],
  ['Mars Odyssey THEMIS day / night IR mosaics (Mars Trek)', 'https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/WMTSCapabilities.xml'],
  ['Viking MDIM 2.1 colour mosaic – background outside the CTX area (Mars Trek)', 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml'],
  ['MRO CTX DTM of Jezero, 20 m (USGS Astrogeology / Mars 2020) – elevation & slope', 'https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'],
  ['Mars 2020 Perseverance traverse & waypoints (NASA/JPL-Caltech)', 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json'],
  ['NASA – Perseverance Mars rock samples list', 'https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/'],
  ['HiRISE observations (University of Arizona / NASA)', 'https://www.uahirise.org/ESP_045994_1985'],
  ['Perseverance raw images – point-of-view photos at each science stop (NASA/JPL-Caltech)', 'https://mars.nasa.gov/mars2020/multimedia/raw-images/'],
  ['NASA DONKI space weather – WSA-ENLIL CME arrival predictions at Mars (live)', 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/'],
  ['ESA Mars Express HRSC + MGS MOLA blended elevation (partner agency data, via Mars Trek)', 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw/1.0.0/WMTSCapabilities.xml'],
  ['MRO CRISM mineral maps – MTRDR browse products (NASA PDS Geosciences Node)', 'https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/'],
  ['CRISM browse product definitions: Viviano-Beck et al. 2014, JGR Planets', 'https://doi.org/10.1002/2014JE004627'],
  ['MRO CRISM clays: Ehlmann et al. 2008, Nature Geoscience', 'https://doi.org/10.1038/ngeo207'],
  ['MRO CRISM clays, carbonate & olivine: Goudge et al. 2015, JGR Planets', 'https://doi.org/10.1002/2014JE004782'],
  ['MRO CRISM marginal carbonates: Horgan et al. 2020, Icarus', 'https://doi.org/10.1016/j.icarus.2019.113526'],
  ['MSL Curiosity RAD surface dose: Hassler et al. 2014, Science (0.64 ± 0.12 mSv/day)', 'https://doi.org/10.1126/science.1244797'],
  ['NASA radiation limits (NASA-STD-3001, 600 mSv career)', 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf'],
  ['NASA Exploration EVA ConOps (8 h EVA, ~2 km/h walking)', 'https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf'],
];

export function initAbout() {
  const dlg = document.getElementById('about');
  document.getElementById('about-content').innerHTML = `
    <h2>Marswalk Planner</h2>
    <p>A layered map of Jezero Crater combining data from several NASA missions to help a future
    astronaut plan a Marswalk (EVA) that is both safe and scientifically useful.
    Built for the NASA Space Apps Challenge 2026 – "Interplanetary Survival Guide: Martian Map".</p>
    <h3>NASA data used</h3>
    <ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join('')}</ul>
    <h3>Estimates &amp; assumptions</h3>
    <ul>
      <li>Walking speed: 2 km/h on flat ground (NASA EVA ConOps), slowed on slopes using the shape of Tobler's hiking function.</li>
      <li>Oxygen: 8 h suit, 25% kept as reserve (our choice); 20 min per science stop (our choice).</li>
      <li>Radiation: Curiosity RAD's quiet-Sun Gale-crater rate, assumed similar at Jezero. Solar storms are not added to the dose; instead a live NASA DONKI check warns when a CME is predicted to reach Mars.</li>
      <li>Walking pace can be lowered with the slider to account for carried tools and samples (user's assumption).</li>
      <li>Slopes: steepest 20 m slope inside each 100 m cell. Boulders and loose sand smaller than the DTM can resolve are not detected.</li>
      <li>Science-stop and sample positions are Perseverance's own position on the cited sol.</li>
    </ul>
    <h3>AI assistance</h3>
    <p>The code and data-processing scripts were written with the help of Claude Code (Anthropic), then reviewed and
    tested by our team. The idea, challenge choice and design decisions are the team's. No images, video or audio in
    the app were AI-generated: all imagery is NASA data.</p>
    <p class="small">Not affiliated with or endorsed by NASA. Built with Leaflet and Chart.js.</p>`;
  document.getElementById('about-link').addEventListener('click', (e) => {
    e.preventDefault();
    dlg.showModal();
  });
}
