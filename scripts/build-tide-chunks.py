#!/usr/bin/env python3
"""
Build Anchor Mate's offline tide files from EOT20, DGFI-TUM's global ocean tide model from
satellite altimetry (Hart-Davis et al. 2021, CC BY 4.0, https://doi.org/10.17882/79489).

  pip install netCDF4 numpy pillow
  curl -L -o eot20.zip "https://www.seanoe.org/data/00683/79489/data/85762.zip"
  unzip eot20.zip ocean_tides.zip && unzip ocean_tides.zip -d eot20
  python3 scripts/build-tide-chunks.py eot20/ocean_tides out/tides/eot20

The model is a 0.125° grid (about 14 km) of 17 tidal constituents, ocean tide relative to
mean sea level. This cuts it into 5° × 5° chunks (41 × 41 points, sharing their edges so
interpolation never needs a neighbour), real and imaginary parts in millimetres as int16
(-32768 = land), packed big-endian into the RGB bytes of a PNG for lossless compression
that any web view can decode:

  out/tides/eot20/{i}_{j}.png   i = floor(lon / 5) for lon 0–360, j = floor((lat + 90) / 5)
  out/tides/eot20/meta.json     constituents, grid, chunk layout

Byte index of a value: (((row * 41 + col) * NC + k) * 2 + part) * 2, row from the south,
part 0 = real (A cos G), 1 = imag (A sin G).
"""
import json
import math
import os
import sys

import netCDF4
import numpy as np
from PIL import Image

CONSTITUENTS = ["M2", "S2", "N2", "K2", "K1", "O1", "P1", "Q1", "2N2", "T2", "J1", "M4", "S1", "MF", "MM", "SA", "SSA"]
STEP = 0.125
CHUNK = 5
N = int(CHUNK / STEP) + 1  # 41 points, edges shared
WIDTH = 256


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    re_all = []
    im_all = []
    for c in CONSTITUENTS:
        d = netCDF4.Dataset(os.path.join(src, f"{c}_ocean_eot20.nc"))
        amp = np.ma.filled(d["amplitude"][:], np.nan)
        re = np.ma.filled(d["real"][:], np.nan)
        im = np.ma.filled(d["imag"][:], np.nan)
        land = ~np.isfinite(amp) | (amp == 0)
        re[land] = np.nan
        im[land] = np.nan
        re_all.append(re)
        im_all.append(im)
        d.close()
    re_all = np.stack(re_all, axis=-1)  # (1441 lat, 2881 lon, NC) in cm
    im_all = np.stack(im_all, axis=-1)
    nc = len(CONSTITUENTS)
    count = 0
    total = 0
    for j in range(int(180 / CHUNK)):
        for i in range(int(360 / CHUNK)):
            r0 = j * (N - 1)
            c0 = i * (N - 1)
            re = re_all[r0 : r0 + N, c0 : c0 + N, :]
            im = im_all[r0 : r0 + N, c0 : c0 + N, :]
            if not np.isfinite(re).any():
                continue
            vals = np.stack([re, im], axis=-1)  # (N, N, NC, 2)
            mm = np.where(np.isfinite(vals), np.round(vals * 10), -32768)
            mm = np.clip(mm, -32768, 32767).astype(">i2")
            raw = mm.tobytes()
            pad = (-len(raw)) % (WIDTH * 3)
            buf = np.frombuffer(raw + b"\0" * pad, dtype=np.uint8).reshape(-1, WIDTH, 3)
            f = os.path.join(out, f"{i}_{j}.png")
            Image.fromarray(buf, "RGB").save(f, optimize=True)
            count += 1
            total += os.path.getsize(f)
    meta = {
        "model": "EOT20",
        "source": "EOT20 ocean tide model, DGFI-TUM (Hart-Davis et al. 2021), CC BY 4.0",
        "datum": "MSL",
        "units": "mm",
        "constituents": CONSTITUENTS,
        "step": STEP,
        "chunk": CHUNK,
        "points": N,
        "width": WIDTH,
        "chunks": count,
    }
    with open(os.path.join(out, "meta.json"), "w") as fh:
        json.dump(meta, fh)
    print(f"{count} chunks, {total / 1e6:.1f} MB → {out}")


if __name__ == "__main__":
    main()
