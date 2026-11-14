# AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
"""
make_science_targets.py – build public/data/science_targets.geojson.

We don't type in coordinates by hand. Each science stop is placed where
Perseverance actually stood while studying it: the rover's position (from the
official Mars 2020 waypoint feed, see fetch_rover.py) on a cited sol, usually
the sol a sample was sealed (NASA "Mars Rock Samples" page).

Each target also gets the nearest of a few verified HiRISE observations
(uahirise.org pages checked to load) so users can open the full image.

Run after fetch_rover.py:   python3 scripts/make_science_targets.py
"""

import json
import math
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent

GENERATED_BY = ("Created by scripts/make_science_targets.py from the NASA sources listed in it; "
                "script written with AI assistance (Claude Code, Anthropic) and reviewed by the team.")
DATA = ROOT / "public" / "data"

SAMPLES_PAGE = "https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/"
CRISM_CLAYS = "Ehlmann et al. 2008, Nature Geoscience, doi:10.1038/ngeo207; Goudge et al. 2015, JGR Planets, doi:10.1002/2014JE004782"
CRISM_CARB = "Horgan et al. 2020, Icarus, doi:10.1016/j.icarus.2019.113526"
CRISM_OLIV = "Goudge et al. 2015, JGR Planets, doi:10.1002/2014JE004782"

# HiRISE observations (centre lat, lon read from each uahirise.org page)
HIRISE = [
    ("ESP_068294_1985", "Perseverance Hardware One Day after Landing", 18.465, 77.430),
    ("ESP_068360_1985", "Perseverance on the Ground in Color", 18.442, 77.452),
    ("ESP_045994_1985", "Candidate Landing Site for 2020 Mission in Jezero Crater", 18.427, 77.437),
    ("ESP_042315_1985", "Candidate Landing Site (western delta)", 18.459, 77.373),
    ("ESP_037119_1985", "Head of Jezero Crater Fan", 18.509, 77.281),
    ("ESP_023379_1985", "Proposed Landing Site in Jezero Crater", 18.345, 77.525),
]

# name, sol to take the rover position from, short "why it matters",
# mission/instrument, source text, approximate? (True = area, not exact spot)
TARGETS = [
    ("Crater floor – Máaz / Ch'ał outcrop", 377,
     "Igneous (volcanic) rocks of the crater floor near the landing site. They record "
     "what Jezero's floor is made of and give the lake deposits an age reference.",
     "Mars 2020 (samples Ha'ahóni & Atsá)", SAMPLES_PAGE, False),
    ("Séítah – olivine-rich rocks", 262,
     "Olivine-rich igneous rocks. Olivine was mapped from orbit by MRO CRISM and "
     "confirmed by Perseverance's samples (Salette, Coulettes).",
     "MRO CRISM + Mars 2020", f"{CRISM_OLIV}; {SAMPLES_PAGE}", False),
    ("Delta front – Wildcat Ridge", 509,
     "Fine-grained sedimentary rock laid down in the ancient lake. CRISM found "
     "Fe/Mg clay minerals in the Jezero delta – clays are good at preserving "
     "organic molecules (samples Hazeltop & Bearwallow).",
     "MRO CRISM + Mars 2020", f"{CRISM_CLAYS}; {SAMPLES_PAGE}", False),
    ("Three Forks sample depot (area)", 690,
     "Ten sample tubes were left on the surface here (completed 28 Jan 2023) as a "
     "backup for a future sample-return mission.",
     "Mars 2020",
     "https://www.jpl.nasa.gov/news/nasas-perseverance-rover-completes-mars-sample-depot/", True),
    ("Upper fan – Berea", 749,
     "Top of the delta/fan, where rivers dropped coarser rocks carried from outside "
     "the crater (sample Melyn).",
     "Mars 2020", SAMPLES_PAGE, False),
    ("Margin carbonates – Bunsen Peak", 1088,
     "Carbonate rocks along the inner crater rim, mapped from orbit by MRO CRISM as "
     "the 'marginal carbonates' unit. Carbonates can form in water and can trap "
     "signs of life (sample Comet Geyser, silica-cemented carbonate).",
     "MRO CRISM + Mars 2020", f"{CRISM_CARB}; {SAMPLES_PAGE}", False),
    ("Cheyava Falls – Neretva Vallis", 1215,
     "Rock with 'leopard spot' textures in the river channel that once fed the lake. "
     "One of the most-studied astrobiology targets of the mission (sample Sapphire Canyon).",
     "Mars 2020", SAMPLES_PAGE, False),
    ("Crater rim – Witch Hazel Hill", 1433,
     "Ancient rocks from deep in the crust, pushed up by the impact that made Jezero, "
     "including serpentinite (sample Green Gardens) – a rock that forms when water "
     "reacts with olivine.",
     "Mars 2020", SAMPLES_PAGE, False),
]


RAW_API = "https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&sol={sol}"
# Cameras that show the scene the way an astronaut would see it, best first
POV_CAMERAS = ["NAVCAM_LEFT", "MCZ_LEFT", "FRONT_HAZCAM_LEFT_A"]


def pov_images(sol, max_images=3):
    """Pick a few full-frame Perseverance raw images taken on `sol`
    (Navcam wide views first, then Mastcam-Z, then Hazcam; max 2 per camera), skipping tiny sub-frames."""
    try:
        with urllib.request.urlopen(RAW_API.format(sol=sol), timeout=60) as r:
            images = json.load(r)["images"]
    except Exception as err:  # the app still works without photos
        print(f"  (no raw images for sol {sol}: {err})")
        return []
    picked = []
    for cam in POV_CAMERAS:
        per_cam = 0
        for im in images:
            w = int(im["extended"]["dimension"].strip("()").split(",")[0])
            if (im["camera"]["instrument"] == cam and w >= 1000
                    and len(picked) < max_images and per_cam < 2):
                per_cam += 1
                picked.append({
                    "thumb": im["image_files"]["small"],
                    "large": im["image_files"]["large"],
                    "camera": im["camera"]["instrument"],
                    "sol": im["sol"],
                })
    return picked


def dist_km(lat1, lon1, lat2, lon2):
    """Great-circle distance on Mars (radius 3396.19 km)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 3396.19 * math.asin(math.sqrt(a))


def main():
    wps = json.loads((DATA / "perseverance_waypoints.json").read_text())["waypoints"]
    feats = []
    for name, sol, why, mission, source, approx in TARGETS:
        p = [w for w in wps if w["sol"] <= sol][-1]  # last position fix on/before that sol
        hid, htitle, hlat, hlon = min(HIRISE, key=lambda h: dist_km(p["lat"], p["lon"], h[2], h[3]))
        feats.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "why": why,
                "mission": mission,
                "source": source,
                "position": (f"{'Approximate area: ' if approx else ''}Perseverance's "
                             f"position on sol {p['sol']} (Mars 2020 waypoint feed)"),
                "elev_m": round(p["elev"]),
                "sol": p["sol"],
                # Perseverance's own point-of-view photos from that sol
                "pov_images": pov_images(p["sol"]),
                "hirise_id": hid,
                "hirise_title": htitle,
                "hirise_url": f"https://www.uahirise.org/{hid}",
                "hirise_km": round(dist_km(p["lat"], p["lon"], hlat, hlon), 1),
            },
            "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
        })
    (DATA / "science_targets.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "generated_by": GENERATED_BY, "features": feats}, indent=1, ensure_ascii=False))
    for f in feats:
        print(f"{f['properties']['name']:40s} {f['geometry']['coordinates']}  "
              f"{f['properties']['hirise_id']} ({f['properties']['hirise_km']} km)")


if __name__ == "__main__":
    main()
