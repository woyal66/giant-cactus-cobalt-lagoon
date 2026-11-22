#!/usr/bin/env python3
"""
Build terrarium depth tiles for Anchor Mate from the Geoscience Australia
"Great Barrier Reef bathymetry 2020 30 m" grids (Beaman, CC BY 4.0, heights relative
to mean sea level). Covers 142–156° E, 10–29° S: Torres Strait, the whole reef, the
Coral Sea and the coast south to about the NSW border.

  pip install rasterio numpy pillow
  curl -LO "https://files.ausseabed.gov.au/survey/Great%20Barrier%20Reef%20Bathymetry%202020%2030m.zip"
  unzip "Great Barrier Reef Bathymetry 2020 30m.zip" -d gbr30
  python3 scripts/build-depth-tiles.py gbr30 out/depth

The same script builds the worldwide shelf tiles from GEBCO_2026 (public domain, 15 arc-second,
about 450 m), zoom 3–8:

  curl -L -o gebco.zip "https://dap.ceda.ac.uk/bodc/gebco/global/gebco_2026/ice_surface_elevation/geotiff/gebco_2026_geotiff.zip"
  unzip gebco.zip -d gebco
  python3 scripts/build-depth-tiles.py gebco out/depth-world --zmin 3 --zmax 8 --land-cap 5 \
      --source "GEBCO_2026 Grid (GEBCO Compilation Group 2026), public domain"

Writes out/depth/{z}/{x}/{y}.png for zoom 7–12 (z12 ≈ 35 m a pixel, close to the 30 m grid)
plus out/depth/meta.json. Only tiles with water shallower than DEEP_M are written: deep
ocean and inland tiles are left out and the app falls back to its global depth source
there. Pixels with no data are written as 0,0,0 (terrarium −32768 m), which the app
treats as "no data" and fills from the fallback.

Terrarium: height = R*256 + G + B/256 - 32768. Heights are rounded to 0.1 m to keep the
PNGs small.
"""
import argparse
import json
import math
import os
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from PIL import Image

Z_MIN, Z_MAX = 7, 12
DEEP_M = 200.0  # keep tiles that have some water shallower than this
SIZE = 256
R = 6378137.0
NODATA = -9999.0

SRC_DIR = None
SOURCES = []
ZMAX_RUN = Z_MAX


def tile_bounds_3857(z, x, y):
    n = 2**z
    span = 2 * math.pi * R / n
    west = -math.pi * R + x * span
    north = math.pi * R - y * span
    return west, north - span, west + span, north


def lnglat_to_tile(lng, lat, z):
    n = 2**z
    x = int((lng + 180) / 360 * n)
    s = math.sin(math.radians(lat))
    y = int((0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n)
    return x, y


def init(src_dir, zmax=Z_MAX, land_cap=None):
    global SRC_DIR, SOURCES, ZMAX_RUN, LAND_CAP
    ZMAX_RUN = zmax
    LAND_CAP = land_cap
    SRC_DIR = src_dir
    SOURCES = []
    for name in sorted(os.listdir(src_dir)):
        if name.endswith(".tif"):
            ds = rasterio.open(os.path.join(src_dir, name))
            SOURCES.append(ds)


def render(z, x, y):
    w, s, e, n = tile_bounds_3857(z, x, y)
    dst_t = from_bounds(w, s, e, n, SIZE, SIZE)
    out = np.full((SIZE, SIZE), np.nan, dtype=np.float32)
    # Tile in degrees, to skip grids that don't overlap.
    lng_w = math.degrees(w / R)
    lng_e = math.degrees(e / R)
    lat_s = math.degrees(2 * math.atan(math.exp(s / R)) - math.pi / 2)
    lat_n = math.degrees(2 * math.atan(math.exp(n / R)) - math.pi / 2)
    for ds in SOURCES:
        b = ds.bounds
        if b.right <= lng_w or b.left >= lng_e or b.top <= lat_s or b.bottom >= lat_n:
            continue
        buf = np.full((SIZE, SIZE), NODATA, dtype=np.float32)
        reproject(
            source=rasterio.band(ds, 1),
            destination=buf,
            dst_transform=dst_t,
            dst_crs="EPSG:3857",
            src_nodata=NODATA,
            dst_nodata=NODATA,
            resampling=Resampling.bilinear if z >= ZMAX_RUN else Resampling.average,
        )
        fill = np.isnan(out) & (buf != NODATA)
        out[fill] = buf[fill]
    return out


def encode(h):
    nod = np.isnan(h)
    v = np.where(nod, -32768.0, np.round(h * 10) / 10) + 32768.0
    v = np.clip(v, 0, 65535.996)
    r = np.floor(v / 256)
    g = np.floor(v - r * 256)
    b = np.floor((v - r * 256 - g) * 256)
    rgb = np.stack([r, g, b], axis=-1).astype(np.uint8)
    rgb[nod] = 0
    return Image.fromarray(rgb, "RGB")


def keep(h):
    v = h[~np.isnan(h)]
    if v.size == 0:
        return False
    water = v[v < 0]
    return water.size > 0 and water.max() > -DEEP_M


LAND_CAP = None


def job(args):
    z, x, y, out_dir = args
    h = render(z, x, y)
    if not keep(h):
        return 0
    if LAND_CAP is not None:
        h = np.where(h > LAND_CAP, LAND_CAP, h)
    path = os.path.join(out_dir, str(z), str(x))
    os.makedirs(path, exist_ok=True)
    f = os.path.join(path, f"{y}.png")
    encode(h).save(f, optimize=True)
    return os.path.getsize(f)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src_dir")
    ap.add_argument("out_dir")
    ap.add_argument("--zmin", type=int, default=Z_MIN)
    ap.add_argument("--zmax", type=int, default=Z_MAX)
    ap.add_argument("--land-cap", type=float, default=None, help="cap land heights (m) to keep tiles small")
    ap.add_argument("--source", default="Great Barrier Reef bathymetry 2020 30 m (Beaman, Geoscience Australia), CC BY 4.0")
    args = ap.parse_args()
    src_dir, out_dir = args.src_dir, args.out_dir
    init(src_dir, args.zmax, args.land_cap)
    west = max(-180.0, min(d.bounds.left for d in SOURCES))
    east = min(180.0, max(d.bounds.right for d in SOURCES))
    south = max(-85.0, min(d.bounds.bottom for d in SOURCES))
    north = min(85.0, max(d.bounds.top for d in SOURCES))
    total = 0
    count = 0
    with ProcessPoolExecutor(initializer=init, initargs=(src_dir, args.zmax, args.land_cap)) as pool:
        for z in range(args.zmin, args.zmax + 1):
            x0, y0 = lnglat_to_tile(west, north, z)
            x1, y1 = lnglat_to_tile(east - 1e-9, south + 1e-9, z)
            jobs = [(z, x, y, out_dir) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
            sizes = list(pool.map(job, jobs, chunksize=16))
            n = sum(1 for s in sizes if s)
            total += sum(sizes)
            count += n
            print(f"z{z}: {n} of {len(jobs)} tiles, {sum(sizes) / 1e6:.1f} MB", flush=True)
    meta = {
        "source": args.source,
        "datum": "MSL",
        "minzoom": args.zmin,
        "maxzoom": args.zmax,
        "bounds": [west, south, east, north],
        "tiles": count,
    }
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f)
    print(f"{count} tiles, {total / 1e6:.1f} MB → {out_dir}")


if __name__ == "__main__":
    main()
