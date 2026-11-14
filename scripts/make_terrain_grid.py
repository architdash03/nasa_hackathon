# AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
"""
make_terrain_grid.py – turn the Jezero CTX DTM into a small JSON grid for the web app.

Input  : MRO CTX DTM of Jezero Crater, 20 m/pixel, elevations in metres relative
         to the Mars areoid ("geoid"). Produced for Mars 2020 terrain-relative
         navigation and hosted by USGS Astrogeology. Same product as Mars Trek's
         "MRO CTX, Jezero DEM, Controlled".
         https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
Output : public/data/jezero_terrain.json
         - elev  : mean elevation of each 100 m x 100 m cell (metres, rounded)
         - slope : MAXIMUM slope (degrees) found inside each cell, computed from
                   the full-resolution 20 m DTM. Using the max is deliberately
                   conservative for hazard mapping.

Run:
    python3 -m venv .venv && .venv/bin/pip install numpy tifffile
    .venv/bin/python scripts/make_terrain_grid.py
"""

import json
import math
import pathlib
import urllib.request

import numpy as np
import tifffile

ROOT = pathlib.Path(__file__).resolve().parent.parent

GENERATED_BY = ("Created by scripts/make_terrain_grid.py from the NASA sources listed in it; "
                "script written with AI assistance (Claude Code, Anthropic) and reviewed by the team.")
RAW = ROOT / "scripts" / "raw" / "jezero_ctx_dtm_20m.tif"
OUT = ROOT / "public" / "data" / "jezero_terrain.json"
URL = ("https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/"
       "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif")

MARS_R = 3396190.0  # metres, IAU Mars 2000 sphere (the DTM's datum)
BLOCK = 5           # 5 x 20 m pixels = 100 m output cells


def download_if_missing():
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        print("Downloading DTM (~9.7 MB)...")
        urllib.request.urlretrieve(URL, RAW)


def main():
    download_if_missing()

    with tifffile.TiffFile(RAW) as tif:
        page = tif.pages[0]
        dem = page.asarray().astype(np.float64)
        px_x, px_y, _ = page.tags["ModelPixelScaleTag"].value      # 20, 20
        tie = page.tags["ModelTiepointTag"].value                    # (i,j,k, X,Y,Z)
        x0, y0 = tie[3], tie[4]                                      # top-left corner, metres

    # No-data pixels are a huge negative number → turn them into NaN
    dem[dem < -1e30] = np.nan
    rows, cols = dem.shape

    # Equirectangular (latitude of true scale = 0, centre lon = 0) on a sphere:
    #   x = R * lon(rad),  y = R * lat(rad)
    west = math.degrees(x0 / MARS_R)
    north = math.degrees(y0 / MARS_R)
    east = west + math.degrees(cols * px_x / MARS_R)
    south = north - math.degrees(rows * px_y / MARS_R)
    print(f"DTM {cols}x{rows} px, lon {west:.4f}..{east:.4f}, lat {south:.4f}..{north:.4f}")

    # ---- Slope at full 20 m resolution ----
    # In this projection a pixel is 20 m tall, but only 20*cos(lat) m wide on the ground.
    lats = north - (np.arange(rows) + 0.5) * (north - south) / rows
    dx = px_x * np.cos(np.radians(lats))[:, None]   # metres per pixel, east-west
    dy = px_y                                       # metres per pixel, north-south
    dz_dy, dz_dx = np.gradient(dem)                 # elevation change per pixel
    slope = np.degrees(np.arctan(np.hypot(dz_dx / dx, dz_dy / dy)))

    # ---- Downsample to 100 m cells ----
    ny, nx = rows // BLOCK, cols // BLOCK
    d = dem[: ny * BLOCK, : nx * BLOCK].reshape(ny, BLOCK, nx, BLOCK)
    s = slope[: ny * BLOCK, : nx * BLOCK].reshape(ny, BLOCK, nx, BLOCK)
    with np.errstate(all="ignore"):
        elev_cells = np.nanmean(d, axis=(1, 3))
        slope_cells = np.nanmax(s, axis=(1, 3))
    # the cropped grid's real extent
    east = west + math.degrees(nx * BLOCK * px_x / MARS_R)
    south = north - math.degrees(ny * BLOCK * px_y / MARS_R)

    def to_list(a, ndigits=0):
        return [None if math.isnan(v) else int(round(v)) for v in a.ravel()]

    valid = slope_cells[~np.isnan(slope_cells)]
    print("cell max-slope percentiles 50/90/99:", np.percentile(valid, [50, 90, 99]).round(1))
    print("share of cells >15°: %.1f%%, >25°: %.1f%%" % (
        100 * (valid > 15).mean(), 100 * (valid > 25).mean()))

    out = {
        "generated_by": GENERATED_BY,
        "source": "MRO CTX DTM of Jezero (JEZ_ctx_B_soc_008, 20 m/px), USGS Astrogeology / NASA Mars 2020",
        "sourceUrl": URL,
        "note": "elev = mean of 100 m cell (m, relative to Mars areoid); slope = max 20 m-pixel slope in cell (deg)",
        "bounds": {"west": west, "east": east, "south": south, "north": north},
        "nx": nx,
        "ny": ny,
        "cellMeters": BLOCK * px_x,
        "elev": to_list(elev_cells),
        "slope": to_list(slope_cells),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB), grid {nx}x{ny}")

    write_hazard_zones(slope_cells, west, north, east, south)


def write_hazard_zones(slope_cells, west, north, east, south, threshold=25, min_cells=4):
    """Group touching >threshold° cells into zones (flood fill) and save the
    biggest ones as labelled points: public/data/hazard_zones.geojson."""
    ny, nx = slope_cells.shape
    steep = np.nan_to_num(slope_cells) > threshold
    seen = np.zeros_like(steep)
    zones = []
    for r0 in range(ny):
        for c0 in range(nx):
            if not steep[r0, c0] or seen[r0, c0]:
                continue
            stack, cells = [(r0, c0)], []
            seen[r0, c0] = True
            while stack:  # flood fill over the 8 neighbours
                r, c = stack.pop()
                cells.append((r, c))
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        rr, cc = r + dr, c + dc
                        if 0 <= rr < ny and 0 <= cc < nx and steep[rr, cc] and not seen[rr, cc]:
                            seen[rr, cc] = True
                            stack.append((rr, cc))
            if len(cells) >= min_cells:
                rows_, cols_ = zip(*cells)
                zones.append({
                    "cells": len(cells),
                    "max": float(max(slope_cells[r, c] for r, c in cells)),
                    "lat": north - (np.mean(rows_) + 0.5) / ny * (north - south),
                    "lon": west + (np.mean(cols_) + 0.5) / nx * (east - west),
                })
    zones.sort(key=lambda z: -z["cells"])
    feats = [{
        "type": "Feature",
        "properties": {
            "label": f"Steep zone #{i + 1}",
            "max_slope_deg": round(z["max"]),
            "area_km2": round(z["cells"] * 0.01, 2),  # each cell is 100 m x 100 m
        },
        "geometry": {"type": "Point", "coordinates": [round(z["lon"], 5), round(z["lat"], 5)]},
    } for i, z in enumerate(zones[:15])]
    path = OUT.parent / "hazard_zones.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "generated_by": GENERATED_BY, "features": feats}, indent=1))
    print(f"Wrote {path.relative_to(ROOT)}: {len(feats)} zones (of {len(zones)} with ≥{min_cells} cells)")


if __name__ == "__main__":
    main()
