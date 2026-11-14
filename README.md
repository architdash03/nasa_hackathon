# Marswalk Planner – Jezero Crater

**NASA Space Apps Challenge 2026 · "Interplanetary Survival Guide: Martian Map" (Intermediate)**

Marswalk Planner is a layered, interactive map of Jezero Crater, the landing site of NASA's Perseverance rover. It combines data from six NASA missions (MRO, MGS, Mars Odyssey, Mars 2020, MSL and Viking) so a future astronaut can plan a Marswalk (EVA) that is safe and scientifically useful. You draw a walking route, and the app shows:
- the terrain slope along it,
- the steep hazards it crosses,
- the elevation profile,
- walking time against the suit's oxygen budget,
- the estimated radiation dose,
- which science targets it visits.

A "Make route safer" button re-plans the route around steep terrain automatically.

> Live demo: `<add your Vercel / GitHub Pages link>` · Open with `?tour` for the 4-step guided tour.

---

## Features

| Area | What it does |
|---|---|
| **Map** | Full-screen Leaflet map in a custom Mars coordinate system. Basemaps: MRO CTX imagery (~6 m/px), MGS MOLA colour elevation, MOLA + ESA Mars Express HRSC elevation, Odyssey THEMIS day and night infrared. Overlays: 25 cm/px HiRISE mosaic, and **MRO CRISM mineral maps** (clays, carbonates, olivine/pyroxene) with an official colour legend. Lat/lon/elevation/slope readout and a scale bar. |
| **Science** | 8 ★ science targets. Each has why it matters, the mission/instrument, citations (CRISM papers, NASA sample list), **Perseverance's own photos from that spot** ("what you'll see when you arrive"), a HiRISE image link and a "zoom to 25 cm" button. Also shows Perseverance's real traverse (45 km, to sol 2022) and all 30 sample sites; tubes left at the Three Forks depot are highlighted. |
| **Hazards** | Slope map from the 20 m CTX elevation model (yellow > 15°, red > 25°), plus 15 automatically labelled ⚠ steep zones. |
| **Route planner** | Click to add points, drag to move them, undo, clear, round-trip option. Shows distance, climb, steepest slope and hazard warnings. Hazardous stretches are painted on the map. A Chart.js elevation profile moves a marker on the map as you hover it. |
| **Survival checklist** | Oxygen (EVA time vs 8 h suit with a 25% reserve), slope safety, radiation dose (Curiosity RAD), and science stops visited. A pace slider lowers walking speed for carried tools and samples. |
| **Current conditions** | Live space weather: NASA DONKI's WSA-ENLIL model runs that predict a CME arriving at Mars. A predicted arrival within the next 3 days switches the radiation check to a warning. |
| **Safe routing** | "🛡 Make route safer" runs an A* search over the slope grid: > 25° is impassable, 15–25° is penalised. "⭐ Recommended route" loads a 7.2 km round trip with 4 science stops and a 13° maximum slope. |
| **Demo** | 4-step guided tour, "About & sources" dialog, mobile layout, dark Mars theme. |

## How to run

```bash
npm install
npm run dev          # open http://localhost:5173  (add ?tour for the guided tour)
npm run build        # production build in dist/
npm run preview      # serve the build locally
```

The app is fully static. The processed data files are already committed in `public/data/`, so Python is only needed to regenerate them:

```bash
python3 -m venv .venv && .venv/bin/pip install numpy tifffile
.venv/bin/python scripts/make_terrain_grid.py     # DTM → elevation/slope grid + hazard zones
python3 scripts/fetch_rover.py                    # rover traverse, waypoints, samples
python3 scripts/make_science_targets.py           # science targets (needs fetch_rover first)
python3 scripts/make_crism_layers.py              # CRISM mineral maps (~13 MB of PNGs)
```

### Deploy

- **Vercel:** import the GitHub repo. Vercel detects Vite, so the defaults (`npm run build`, output `dist`) work.
- **GitHub Pages:** push to `main`, then go to *Settings → Pages → Source: GitHub Actions*. `.github/workflows/deploy.yml` builds and publishes the site. Paths are relative (`base: './'` in `vite.config.js`), so it works under `/<repo-name>/`.

## Project structure (what each file does)

| File | Purpose |
|---|---|
| `index.html` | Page layout: header with credits, map, side panel, About dialog |
| `src/main.js` | Entry point. Creates the map, loads every layer and starts the planner and tour. |
| `src/map.js` | Mars coordinate system (`MarsCRS`), map setup, scale bar, mouse readout |
| `src/layers.js` | Mars Trek tile layers, plus GeoJSON layers for the rover, samples, science targets and hazard zones |
| `src/terrain.js` | Loads the DTM grid. Gives elevation/slope at any point and draws the slope overlay. |
| `src/route.js` | Route planner: drawing, analysis, walking/oxygen/radiation model, checklist, elevation chart |
| `src/pathfind.js` | A* search for the safest path across the slope grid |
| `src/tour.js` | Guided tour and the About & sources dialog |
| `src/spaceweather.js` | Live space-weather check (NASA DONKI), cached for 1 hour |
| `src/style.css` | Dark Mars theme and mobile layout |
| `scripts/make_terrain_grid.py` | Downloads the CTX DTM. Computes 20 m slopes and exports a 100 m grid and hazard zones. |
| `scripts/fetch_rover.py` | Snapshots the official Perseverance traverse and waypoints, and places the samples |
| `scripts/make_crism_layers.py` | Finds every CRISM observation over Jezero (PDS ODE), downloads the mineral browse images, and reads their map projection to get exact bounds |
| `scripts/make_science_targets.py` | Builds the science-target GeoJSON with citations, HiRISE links and Perseverance point-of-view photos |
| `scripts/m20_samples.json` | The 30 samples from NASA's sample page (name, type, sol sealed, location) |
| `public/data/*` | Processed data the app loads |

### How the Mars map works

NASA Mars Trek serves "EQ" (equirectangular) tiles. We read each layer's `WMTSCapabilities.xml` to get the exact tile URL, file format and zoom levels. The grid starts at the top-left corner (−180°, 90°), with 2 × 1 tiles at zoom 0. That is the same grid as Leaflet's built-in `EPSG4326`, so `MarsCRS` copies it and swaps in the Mars radius (3,396,190 m). That keeps distances and the scale bar correct.

## NASA data used

| Dataset | Mission / instrument | Used for | Link |
|---|---|---|---|
| NASA Mars Trek tile service | JPL | All basemaps | https://trek.nasa.gov/mars/ |
| Jezero CTX mosaic (`Jezero_CTX_BlockAdj_dd`) | MRO CTX | Main imagery | [capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0/WMTSCapabilities.xml) |
| Jezero HiRISE 25 cm orthomosaic | MRO HiRISE | Close-up imagery | [capabilities](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml) |
| HiRISE observations ESP_068294_1985, ESP_068360_1985, ESP_045994_1985, ESP_042315_1985, ESP_037119_1985, ESP_023379_1985 | MRO HiRISE | Image links per science stop | https://www.uahirise.org/ESP_045994_1985 |
| MOLA colour hillshade | MGS MOLA | Elevation basemap | [capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml) |
| THEMIS Day / Night IR mosaics | Mars Odyssey THEMIS | Thermal basemaps; night IR hints at loose sand vs rock | [capabilities](https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/WMTSCapabilities.xml) |
| **Partner agency:** MOLA + HRSC blended colour hillshade | MGS MOLA + **ESA Mars Express HRSC** | Elevation basemap | [capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw/1.0.0/WMTSCapabilities.xml) |
| Viking MDIM 2.1 colour mosaic | Viking | Background outside the CTX area | [capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml) |
| Jezero CTX DTM, 20 m (`JEZ_ctx_B_soc_008`) | MRO CTX (Mars 2020 team, USGS Astrogeology) | Elevation, slope, hazards, routing | [GeoTIFF](https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif) |
| Perseverance traverse & waypoints | Mars 2020 | Rover path, sample and target positions | [traverse](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json), [waypoints](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json) |
| Perseverance raw images (Navcam, Mastcam-Z) | Mars 2020 | Point-of-view photos at each science stop | https://mars.nasa.gov/mars2020/multimedia/raw-images/ |
| DONKI WSA-ENLIL simulations (live) | NASA CCMC (Goddard) | Space-weather check: CMEs predicted to reach Mars | https://kauai.ccmc.gsfc.nasa.gov/DONKI/ · API: https://api.nasa.gov |
| Perseverance rock samples | Mars 2020 | 30 sample sites | https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/ |
| Three Forks sample depot | Mars 2020 | Depot target | https://www.jpl.nasa.gov/news/nasas-perseverance-rover-completes-mars-sample-depot/ |
| CRISM mineral maps (MTRDR browse: PHY clays, CAR carbonates, MAF olivine/pyroxene), 8 observations over Jezero | MRO CRISM (spectral) | Mineral map layers | [PDS Geosciences Node](https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/), found via the [ODE REST API](https://oderest.rsl.wustl.edu/); products defined in Viviano-Beck et al. 2014, *JGR Planets*, [doi:10.1002/2014JE004627](https://doi.org/10.1002/2014JE004627) |
| CRISM clays in the Jezero delta | MRO CRISM | Science-target descriptions | Ehlmann et al. 2008, *Nat. Geosci.*, [doi:10.1038/ngeo207](https://doi.org/10.1038/ngeo207); Goudge et al. 2015, *JGR Planets*, [doi:10.1002/2014JE004782](https://doi.org/10.1002/2014JE004782) |
| CRISM marginal carbonates | MRO CRISM | Margin target | Horgan et al. 2020, *Icarus*, [doi:10.1016/j.icarus.2019.113526](https://doi.org/10.1016/j.icarus.2019.113526) |
| RAD surface dose rate: 0.64 ± 0.12 mSv/day | MSL Curiosity RAD | Radiation estimate | Hassler et al. 2014, *Science*, [doi:10.1126/science.1244797](https://doi.org/10.1126/science.1244797) |
| Career radiation limit: 600 mSv | NASA-STD-3001 | Radiation context | [NASA OCHMO brief](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) |
| 8 h EVA, ~2 km/h walking pace | NASA Exploration EVA ConOps (EVA-EXP-0075) | Oxygen and time model | [PDF](https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf) |

## Assumptions & limitations

Everything marked **estimate** in the app is a simplified model, not a measurement.

- **Walking speed (estimate):** 2.0 km/h on flat ground, NASA's planning figure for level regolith. On slopes we scale it with the shape of Tobler's hiking function: fastest on a gentle downhill, slower on steep up- or downhills. The function comes from Earth hiking data, not suited walking on Mars.
- **Oxygen (estimate):** an 8 h suit, with 25% kept in reserve, leaves 6 h usable. Green means the EVA fits in 6 h, yellow means it uses some of the reserve, red means it exceeds 8 h. The 25% reserve and 20 min per science stop are our own choices. We don't model metabolic rate, carried load or suit consumables in detail.
- **Radiation (estimate):** Curiosity's RAD measured 0.64 ± 0.12 mSv/day at Gale Crater (quiet Sun). We assume Jezero is similar, since both are low-elevation sites near the equator. Solar particle events are not added to the dose number. Instead, the live DONKI check warns when a CME is predicted to reach Mars. DONKI gives model forecasts of CME arrival, not radiation measurements at Mars.
- **Space-weather API:** uses NASA's free `DEMO_KEY`, which allows only a few calls per hour per visitor. Results are cached for 1 hour. If the API is unavailable, the app says so and links to DONKI. For heavy use, put your own free api.nasa.gov key in `src/spaceweather.js`.
- **Carried load:** we found no NASA formula for how much carried gear slows a suited walker. The pace slider (1–3 km/h, default 2 km/h) lets the crew set their own assumption.
- **CRISM mineral maps:** these are NASA's standard browse products, shown unaltered. They are colour composites of spectral parameters, a strong hint of a mineral rather than a confirmed identification. Some images show straight coloured lines, which are instrument artifacts. The pixels are 18–36 m, coarser than CTX. Our computed image bounds match the PDS labels to within half a pixel.
  - The RAD figures were confirmed through peer-reviewed papers that cite Hassler et al. 2014; the paper itself was paywalled when we checked.
- **Slopes:** computed from a 20 m DTM, so boulders, small scarps and sand ripples below that size are invisible. Each 100 m cell stores the steepest 20 m slope inside it (conservative). NASA's ConOps lists a 20° slope limit for EVA terrain. We use 15° (caution) and 25° (danger) as display thresholds.
- **DTM accuracy check:** at all 708 Perseverance waypoints, our grid elevation differs from the rover's reported elevation by a median of −0.2 m. 90% are within −6 / +5 m.
- **Positions of science targets and samples:** each one is placed at Perseverance's position fix on the sol it was sampled (sealed). The text descriptions are our own summaries of the cited sources. The Three Forks depot marker shows the approximate area, not individual tubes. Samples 29–30 have no published sealing sol, so their position uses the sol of NASA's drill-hole or target image.
- **Loose sand** is not detected automatically. Use the THEMIS night-IR basemap: darker means lower thermal inertia, i.e. loose material.
- **Rover data** is a snapshot (to sol 2022). Re-run `scripts/fetch_rover.py` to update it.

## Team

`<Team name>`: Ankit Dash, Archit Dash (B.Tech CSE, 1st year)

## AI tools used (Space Apps "Super Intelligence" disclosure)

- **What we used:** Claude Code (Anthropic), a large-language-model coding assistant.
- **How we used it:**
  - inspecting the Mars Trek WMTS capabilities,
  - writing the app code and data-processing scripts,
  - finding and checking citations for the scientific values,
  - drafting documentation.
- **What was not AI:** the project idea, the choice of challenge, location and features, and the design decisions came from the team. The team reviewed and tested every feature.
- **Where it's marked:** every source file starts with an `AI-assisted` comment. `index.html` has an `ai-assistance` meta tag. `package.json` has an `aiAssistance` field. Every data file in `public/data/` has a `generated_by` field.
- **No AI-generated media:** the app contains no AI-generated images, video or audio. All imagery is NASA data. No NASA logos, insignia or mission patches are used.
- **Scientific values:** every one links to its NASA or peer-reviewed source.

## Credits & disclaimer

Data courtesy of NASA/JPL-Caltech, MSSS, University of Arizona, Arizona State University, USGS Astrogeology and NASA Goddard. Built with [Leaflet](https://leafletjs.com) and [Chart.js](https://www.chartjs.org). This project is not affiliated with or endorsed by NASA, and does not use NASA logos or insignia.
