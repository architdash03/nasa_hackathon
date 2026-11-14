# AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
"""
fetch_rover.py – save a small snapshot of Perseverance's official traverse.

Source: the Mars 2020 team's public "Where is the rover?" map data (MMGIS):
    https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json
    https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
Each traverse feature is one drive (with its sol number); each waypoint is a
rover position fix (lon, lat, elevation, sol, total distance driven).

Outputs (in public/data/):
    perseverance_traverse.geojson  – drives as LineStrings (2D, 6 decimals ≈ 6 cm)
    perseverance_waypoints.json    – [{sol, lon, lat, elev, km}] for looking up
                                     where the rover was on a given sol
    perseverance_samples.geojson   – only if scripts/m20_samples.json exists:
                                     each sample is placed at the rover's
                                     position on the sol it was collected

Run:  python3 scripts/fetch_rover.py      (standard library only)
"""

import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent

GENERATED_BY = ("Created by scripts/fetch_rover.py from the NASA sources listed in it; "
                "script written with AI assistance (Claude Code, Anthropic) and reviewed by the team.")
OUT = ROOT / "public" / "data"
BASE = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/"


def get_json(name):
    with urllib.request.urlopen(BASE + name, timeout=60) as r:
        return json.load(r)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # ---- Traverse: keep sol + length, drop the 3rd coordinate, round ----
    trav = get_json("M20_traverse.json")
    feats = []
    for f in trav["features"]:
        coords = [[round(c[0], 6), round(c[1], 6)] for c in f["geometry"]["coordinates"]]
        # remove repeated points (the rover sits still at the start of many drives)
        dedup = [p for i, p in enumerate(coords) if i == 0 or p != coords[i - 1]]
        if len(dedup) < 2:
            continue
        p = f["properties"]
        feats.append({
            "type": "Feature",
            "properties": {"sol": p["sol"], "length_m": p.get("length")},
            "geometry": {"type": "LineString", "coordinates": dedup},
        })
    (OUT / "perseverance_traverse.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "generated_by": GENERATED_BY,
         "source": BASE + "M20_traverse.json",
         "features": feats}, separators=(",", ":")))

    # ---- Waypoints: compact list ----
    wps = get_json("M20_waypoints.json")
    pts = [{
        "sol": w["properties"]["sol"],
        "lon": round(w["properties"]["lon"], 6),
        "lat": round(w["properties"]["lat"], 6),
        "elev": round(w["properties"]["elev_geoid"], 1),
        "km": w["properties"]["dist_km"],
    } for w in wps["features"]]
    pts.sort(key=lambda p: p["sol"])
    (OUT / "perseverance_waypoints.json").write_text(json.dumps(
        {"source": BASE + "M20_waypoints.json", "generated_by": GENERATED_BY, "waypoints": pts}, separators=(",", ":")))
    print(f"traverse: {len(feats)} drives, up to sol {pts[-1]['sol']}, {pts[-1]['km']} km")

    # ---- Samples: position = last rover fix on or before the sampling sol ----
    samples_file = ROOT / "scripts" / "m20_samples.json"
    if samples_file.exists():
        samples = json.loads(samples_file.read_text())
        out = []
        for s in samples:
            before = [p for p in pts if p["sol"] <= s["sol"]]
            if not before:
                continue
            p = before[-1]
            props = dict(s)
            props["position_note"] = (f"Rover position fix from sol {p['sol']} "
                                      f"(sample collected sol {s['sol']})")
            out.append({"type": "Feature", "properties": props,
                        "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]}})
        (OUT / "perseverance_samples.geojson").write_text(json.dumps(
            {"type": "FeatureCollection", "generated_by": GENERATED_BY, "features": out}, indent=1, ensure_ascii=False))
        print(f"samples: {len(out)} placed")


if __name__ == "__main__":
    main()
