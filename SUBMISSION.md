# Space Apps 2026 submission kit

Text for each field of the Space Apps project form, in the form's order. Paste it into **My Team → Project → Edit**, and use **Save Progress** often.
`<…>` marks things only your team can fill in.

---

## 1. Project Name

**Marswalk Planner: a safe, science-rich EVA map for Jezero Crater**

## 2. High-Level Project Summary

Marswalk Planner is an interactive map that helps the first astronauts on Mars plan a Marswalk that is both safe and scientifically valuable. It focuses on Jezero Crater, an ancient lake bed explored by NASA's Perseverance rover, and layers data from several NASA missions plus ESA's Mars Express into one walking-scale view:
- orbital imagery,
- elevation and slopes,
- thermal maps,
- mineral findings,
- the rover's real path, samples and photos,
- radiation measurements,
- live space-weather forecasts.

An astronaut draws a route, and the app checks it the way a mission planner would:
- Is it too steep?
- Is there enough oxygen?
- What radiation dose will it bring, and is a solar storm on its way?
- Which science targets does it reach?

With one click, the app re-plans the route around dangerous slopes. Tools like Mars Trek show regional and global views. Our project zooms into the hyper-local scale of a single excursion, the gap the challenge describes.

## 3. Link to Project Demo

`<public YouTube / Google Drive link to the ≤30 s video, or to the ≤7-slide deck>`

## 4. Link to Final Project

`<public live site, e.g. https://<user>.github.io/<repo>/ or https://<project>.vercel.app>`.
Optionally add the GitHub repo link in the description.

## 5. Detailed Project Description

**What it does.** Marswalk Planner shows Jezero Crater at walking scale and lets a crew plan an EVA (extravehicular activity). You click points on the map to build a route. The app then reports:
- distance (one way or round trip), climb and descent,
- the steepest terrain on the route, with stretches over 15° and 25° painted yellow and red,
- an elevation profile; hovering it moves a marker along the map,
- a **survival checklist**:
  - *oxygen*: walking time plus time at science stops, against an 8-hour suit with a 25% reserve,
  - *slope safety*,
  - *radiation*: estimated dose from Curiosity's RAD measurements, plus a live NASA space-weather check for solar storms (CMEs) heading to Mars,
  - *science stops visited*.

**"🛡 Make route safer"** re-plans every leg with an A* path-finding search. Terrain over 25° is a wall, and 15–25° is strongly avoided. On our test route it cut the steepest slope from 25° to 13°, adding only 360 m of walking. **"⭐ Recommended route"** loads a 7.2 km round trip that visits 4 science targets and stays under 13°.

**Science along the way.** Three CRISM mineral-map layers (clays, carbonates, olivine/pyroxene) show where orbital spectroscopy detected each mineral. Eight science targets mark places where MRO's CRISM spectrometer found clays, carbonates or olivine, and where Perseverance collected samples. Each target popup shows:
- why it matters,
- the mission and instrument behind it,
- citations,
- a HiRISE image link and a zoom into the 25 cm/pixel HiRISE mosaic,
- **Perseverance's own Navcam and Mastcam-Z photos from that exact spot**, so the astronaut knows what to expect on arrival.

The map also shows the rover's real 45 km traverse and all 30 sample sites.

**How it works.**
- **Map:** a static web app (HTML, CSS, JavaScript) built with Vite, Leaflet and Chart.js. We read each layer's WMTS capabilities file and set up a Mars coordinate system with the Mars radius, so distances and the scale bar are correct.
- **Terrain:** a Python script turns the 20 m CTX elevation model into a 100 m grid of elevation and maximum slope.
- **Rover data:** a second script snapshots the official traverse, waypoints and samples.
- **Science targets:** a third script places them at the rover's own position on the cited sols, and attaches HiRISE links and rover photos.

**Validation.** We compared our elevation grid with the elevation Perseverance reported at 708 positions. The median difference is −0.2 m, and 90% are within ±6 m. Every scientific number in the app links to its NASA or peer-reviewed source, and every simplified model is labelled "estimate" and explained.

**Benefits.**
- One screen answers the questions a crew asks before stepping outside: where to go, what to study there, whether it's safe, and whether there's time.
- It runs in any browser, including tablets, so it could work as a habitat planning display or a handheld field tool.

**What we hope to achieve.** A template for EVA planning that any landing site could reuse: swap in another elevation model and rover dataset. Future work:
- a helmet heads-up-display mode,
- buddy-pair EVAs and rover-assisted walk-back limits,
- boulder detection from HiRISE,
- live rover position updates.

**Tools.**
- JavaScript, HTML/CSS, Vite, Leaflet 1.9, Chart.js 4,
- Python 3 with NumPy and tifffile,
- Git/GitHub, deployed as a static site (GitHub Pages or Vercel).

## 6. Use of Super Intelligence (SI)

*(Not shown to judges; for Space Apps data collection.)*

**Yes.** We used Claude Code (Anthropic), a large-language-model coding assistant, to:
- inspect NASA Mars Trek's WMTS capabilities,
- write and debug the JavaScript app and the Python data-processing scripts,
- look up and check citations for scientific values,
- draft documentation.

The project idea, the choice of challenge, site and features, and all design decisions are the team's. The team reviewed and tested every feature.

SI use is marked in:
- an `AI-assisted` comment at the top of every source file,
- an `ai-assistance` meta tag in `index.html`,
- an `aiAssistance` field in `package.json`,
- a `generated_by` field in every data file,
- the README and the app's About dialog.

No images, video or audio were AI-generated. All imagery is NASA data, and no NASA logos or insignia are used.

## 7. NASA Data

- **NASA Mars Trek (JPL) WMTS tiles:**
  - MRO CTX Jezero mosaic
  - MRO HiRISE Jezero 25 cm orthomosaic
  - MGS MOLA colour hillshade
  - Mars Odyssey THEMIS day and night IR mosaics
  - Viking MDIM 2.1
- **MRO CTX DTM of Jezero (20 m):** from the Mars 2020 terrain-relative-navigation products, hosted by USGS Astrogeology. Used for elevation, slope, hazards and routing.
- **MRO HiRISE observations:**
  - ESP_068294_1985
  - ESP_068360_1985
  - ESP_045994_1985
  - ESP_042315_1985
  - ESP_037119_1985
  - ESP_023379_1985
- **MRO CRISM mineral maps:** MTRDR browse products (PHY, CAR, MAF) from 8 targeted observations over Jezero, via the NASA PDS Geosciences Node and ODE.
- **MRO CRISM mineral findings:**
  - Ehlmann et al. 2008, Nature Geoscience
  - Goudge et al. 2015, JGR Planets
  - Horgan et al. 2020, Icarus
- **Mars 2020 Perseverance:**
  - official traverse and waypoint data (mars.nasa.gov MMGIS),
  - NASA's Mars rock samples list,
  - Navcam and Mastcam-Z raw images,
  - Three Forks sample depot (JPL).
- **MSL Curiosity RAD:** surface dose rate 0.64 ± 0.12 mSv/day (Hassler et al. 2014, Science).
- **NASA DONKI** (CCMC, NASA Goddard): live WSA-ENLIL predictions of CME arrival at Mars, via api.nasa.gov.
- **NASA-STD-3001:** 600 mSv career radiation limit.
- **NASA Exploration EVA ConOps (EVA-EXP-0075):** 8 h EVA and ~2 km/h walking pace.

Full links are in the README, "NASA data used" section.

## 8. Space Agency Partner Data and Other References

- **ESA (European Space Agency) Mars Express HRSC:** HRSC + MOLA blended colour elevation basemap (via NASA Mars Trek).
- **Software:**
  - Leaflet (BSD-2-Clause),
  - Chart.js (MIT),
  - Vite (MIT),
  - NumPy (BSD),
  - tifffile (BSD).
- **Method:** Tobler's hiking function (W. Tobler, 1993), used for the shape of the slope-dependent walking-speed model.
- **Scientific papers:** Ehlmann et al. 2008; Goudge et al. 2015; Horgan et al. 2020; Hassler et al. 2014. DOIs are in the README.
- **University of Arizona HiRISE** web pages (uahirise.org).
- **AI tool:** Claude Code (Anthropic). See the SI section.

---

## 30-second demo video script (official timing)

Record the live site in a 1920×1080 browser at `…/?tour`. Burn in English subtitles matching the voice-over; they're required if anyone speaks a language other than English. Keep it **30 s or less**, or the project is not eligible for global judging.

| Time | On screen | Voice-over / subtitle |
|---|---|---|
| 0:00–0:02 | Title card: team name + member names | "We're `<team name>`." |
| 0:02–0:05 | Map opening on Jezero Crater | "Challenge: a Martian map for the first astronauts' Marswalks." |
| 0:05–0:10 | Logo-free title overlay: *Marswalk Planner: walk safe, discover more* | "This is Marswalk Planner: walk safe, discover more." |
| 0:10–0:20 | Fast cuts: ★ popup with rover photos, slope map, draw a route across a red scarp, click 🛡 so it turns green, checklist ✓ with space weather | "NASA orbiter, rover and space-weather data show the crew where to go, what they'll find and how to get there safely, with oxygen, slope and radiation checked live." |
| 0:20–0:30 | Recommended route with the elevation chart hovering; zoom out to all of Jezero | "Swap in any landing site, and every future Marswalk starts with a plan that keeps astronauts safe and makes their science count." |

## Alternative: 7-slide deck (title and intro count toward the 7)

1. **Title:** Marswalk Planner, team name, member names, challenge name
2. **Problem:** existing maps are regional; astronauts need walking-scale plans
3. **Our app:** screenshot plus the user flow (draw → check → re-route)
4. **NASA data layers:** imagery, elevation, thermal, minerals, rover, radiation, space weather (plus ESA HRSC)
5. **Safety:** slope hazards, A* re-routing, oxygen and radiation checklist
6. **Science:** targets with rover photos; validation (−0.2 m median vs rover)
7. **Future:** HUD mode, buddy pairs, any landing site; team thanks

---

## Before you click "Submit for Judging": checklist

- [ ] **Deadline:** Sunday **15 Nov 2026, 11:59 p.m.** in your Local Event's time zone. Submissions saved later are not judged.
- [ ] **Team:** all members are *confirmed* participants at the **same Local Event**. If anyone is waitlisted, contact the Local Lead.
- [ ] **No likeness of anyone under 18** in the video, slides or app. That means no faces, voices or photos. ⚠ If any teammate is 17, keep them out of the video and use a text-only title card.
- [ ] **English everywhere:** form, slides and subtitles.
- [ ] **Links:** the demo and final-project links open in a **private/incognito window** with no login (Drive: "Anyone with the link"; YouTube: public or unlisted).
- [ ] **AI-made media:** if you add any AI-generated images or video to the deck or video, they need a visible "AI-generated" watermark. Ours has none.
- [ ] **No NASA logo, insignia or mission patches** in the video or slides. Our app uses none.
- [ ] **Optional:** request a FortiGuard Web Filter classification for the live site (category "Web-based Applications" or "Education"; Company Name "N/A"), so judges' networks don't block it.
- [ ] Tick "Terms and Conditions" and "Confirm All Work is Original", then click **Submit for Judging** and wait for the confirmation banner. You can resubmit until the deadline.
- [ ] Team names and the live link are filled into README.md.
