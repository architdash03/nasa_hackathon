# AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
"""
make_crism_layers.py – download MRO CRISM mineral maps of Jezero for the web app.

Source: NASA PDS Geosciences Node, CRISM "MTRDR" (map-projected targeted reduced
data records). For every CRISM targeted observation that covers Jezero, the PDS
provides ready-made colour "browse" images of mineral summary parameters
(Viviano-Beck et al. 2014, JGR Planets, doi:10.1002/2014JE004627):

  PHY – hydrated / hydroxylated minerals (clays)
  CAR – carbonates
  MAF – mafic minerals (olivine, pyroxene)

We find the observations with the PDS Orbital Data Explorer (ODE) REST API,
download the browse PNGs and their ENVI .hdr headers, and read the map
projection from the header to get each image's exact lat/lon corners.
The images are NOT changed – they are NASA's own browse products.

Outputs:
  public/data/crism/<obs>_<product>.png
  public/data/crism_index.json   – list of {obs, product, bounds, source URL}

Run:  python3 scripts/make_crism_layers.py      (standard library only)
"""

import json
import math
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent

GENERATED_BY = ("Created by scripts/make_crism_layers.py from the NASA sources listed in it; "
                "script written with AI assistance (Claude Code, Anthropic) and reviewed by the team.")

OUT_DIR = ROOT / "public" / "data" / "crism"
INDEX = ROOT / "public" / "data" / "crism_index.json"

# Jezero area (same as the CTX DTM)
BBOX = dict(westernlon=77.16, easternlon=77.70, minlat=18.21, maxlat=18.72)
ODE = ("https://oderest.rsl.wustl.edu/live2/?query=product&results=fp&output=JSON"
       "&target=mars&ihid=MRO&iid=CRISM&pt=MTRDR&limit=100"
       "&westernlon={westernlon}&easternlon={easternlon}&minlat={minlat}&maxlat={maxlat}")

PRODUCTS = ["PHY", "CAR", "MAF"]


def get(url, binary=False):
    with urllib.request.urlopen(url, timeout=120) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def bounds_from_hdr(hdr_text, width, height):
    """Read ENVI 'map info' + 'projection info' and return
    [[south, west], [north, east]] in degrees.

    CRISM MTRDR uses an equirectangular projection on a sphere:
        x = R * cos(lat_ts) * lon,   y = R * lat     (angles in radians)
    so turning metres back into degrees is a simple division."""
    mi = re.search(r"map info = \{([^}]*)\}", hdr_text).group(1).split(",")
    # map info: name, ref_px_x, ref_px_y, easting, northing, px_size_x, px_size_y, ...
    ref_x, ref_y = float(mi[1]), float(mi[2])
    east0, north0 = float(mi[3]), float(mi[4])
    px_x, px_y = float(mi[5]), float(mi[6])
    pi = re.search(r"projection info = \{([^}]*)\}", hdr_text).group(1).split(",")
    radius, lat_ts = float(pi[1]), float(pi[2])

    # map coordinates of the image's top-left corner (ENVI pixels start at 1)
    left = east0 - (ref_x - 1) * px_x
    top = north0 + (ref_y - 1) * px_y
    right = left + width * px_x
    bottom = top - height * px_y

    k = radius * math.cos(math.radians(lat_ts))
    west, east = math.degrees(left / k), math.degrees(right / k)
    north, south = math.degrees(top / radius), math.degrees(bottom / radius)
    return [[round(south, 6), round(west, 6)], [round(north, 6), round(east, 6)]]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    found = json.loads(get(ODE.format(**BBOX)))["ODEResults"]["Products"]["Product"]
    if isinstance(found, dict):
        found = [found]

    index = []
    for prod in found:
        files = prod["Product_files"]["Product_file"]
        files = [files] if isinstance(files, dict) else files
        obs = prod["pdsid"].split("_")[0].upper()          # e.g. FRT00005C5E
        for kind in PRODUCTS:
            want = f"_BR{kind}J_MTR3"
            urls = {f["FileName"].upper().rsplit(".", 1)[1]: f["URL"]
                    for f in files if want in f["FileName"].upper()}
            if "PNG" not in urls or "HDR" not in urls:
                continue
            hdr = get(urls["HDR"])
            width = int(re.search(r"samples\s*=\s*(\d+)", hdr).group(1))
            height = int(re.search(r"lines\s*=\s*(\d+)", hdr).group(1))
            png_name = f"{obs.lower()}_{kind.lower()}.png"
            (OUT_DIR / png_name).write_bytes(get(urls["PNG"], binary=True))
            index.append({
                "obs": obs,
                "product": kind,
                "file": f"crism/{png_name}",
                "bounds": bounds_from_hdr(hdr, width, height),
                "source": urls["PNG"],
            })
            print(f"{obs} {kind}: {index[-1]['bounds']}")

    INDEX.write_text(json.dumps({
        "generated_by": GENERATED_BY,
        "source": "NASA PDS Geosciences Node – MRO CRISM MTRDR browse products (via ODE REST API)",
        "reference": "Viviano-Beck et al. 2014, JGR Planets, doi:10.1002/2014JE004627",
        "images": index,
    }, indent=1))
    total = sum(p.stat().st_size for p in OUT_DIR.glob("*.png")) / 1e6
    print(f"{len(index)} images, {total:.1f} MB → {INDEX.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
