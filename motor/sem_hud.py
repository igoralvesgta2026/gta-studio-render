# -*- coding: utf-8 -*-
"""Refaz estilo/video001/clipes-sem-hud/ a partir dos clipes (HQ) em estilo/video001/clipes/, com o recorte medido
de cada um (sem_hud_recortes.json: x, y, w, h em fração do quadro). Saída na resolução do clipe de origem."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

AQUI = Path(__file__).resolve().parent
EST = Path(os.environ.get("RENDER_ESTILO") or AQUI.parent / "estilo")
REC = json.loads((AQUI / "sem_hud_recortes.json").read_text(encoding="utf-8"))
SRC, DST = EST / "video001" / "clipes", EST / "video001" / "clipes-sem-hud"
DST.mkdir(parents=True, exist_ok=True)


def um(item):
    n, r = item
    src = SRC / f"{n}.mp4"
    w, h = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                                    "-of", "csv=p=0", str(src)], capture_output=True, text=True).stdout.strip().split(","))
    cw, ch = int(round(w * r["w"] / 2)) * 2, int(round(h * r["h"] / 2)) * 2
    cx, cy = int(round(w * r["x"])), int(round(h * r["y"]))
    cx, cy = min(cx, w - cw), min(cy, h - ch)
    vf = f"crop={cw}:{ch}:{cx}:{cy},scale={w}:{h}:flags=lanczos"
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "medium",
                        "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(DST / f"{n}.mp4")], capture_output=True, text=True)
    return f"FALHOU {n}: {p.stderr[-300:]}" if p.returncode else f"{n} {w}x{h} {vf}"


with ThreadPoolExecutor(4) as ex:
    res = list(ex.map(um, REC.items()))
for x in res: print(x)
if any(x.startswith("FALHOU") for x in res): sys.exit(1)
