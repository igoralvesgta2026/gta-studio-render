"""Render dos vídeos HTML no GitHub Actions (partes em máquinas paralelas).

  python -X utf8 motor/render_gh.py planeja <index.html> <N> [fps]     → imprime a matriz JSON [{"i":0,"f0":..,"f1":..}, ...]
  python -X utf8 motor/render_gh.py junta   <index.html> <pasta_partes> <saida.mp4> [fps]
      → junta pNN.mp4 (na ordem) e mistura o áudio da página (narração + música + efeitos), estéreo.

Cada parte é renderizada pelo próprio renderiza.py em modo trabalhador:
  python -X utf8 motor/renderiza.py <index.html> --_trabalhador --fps 30 --de 0 --f0 F0 --f1 F1 --saida pNN.mp4 --status pNN.json --partes 1
"""
import json, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import renderiza as R


def sonda(html):
    from playwright.sync_api import sync_playwright
    W, H = R.le_dim(Path(html).read_text(encoding="utf-8", errors="ignore"))
    with sync_playwright() as pw:
        b, page, info = R.abre_pagina(pw, Path(html), W, H); b.close()
    return info


def planeja(html, n, fps=30):
    info = sonda(html)
    total = float(info.get("total") or 0)
    if not total: sys.exit("não deu para saber a duração da página")
    F = int(round(total * fps))
    partes = R.divide(F, n, fps, 0.0, info.get("beats") or [])
    print(json.dumps([{"i": i, "f0": a, "f1": b} for i, (a, b) in enumerate(partes)]))


def junta(html, pasta, saida, fps=30):
    html = Path(html).resolve(); pasta = Path(pasta); saida = Path(saida); saida.parent.mkdir(parents=True, exist_ok=True)
    partes = sorted(pasta.rglob("p*.mp4"))
    if not partes: sys.exit("nenhuma parte encontrada")
    lista = pasta / "lista.txt"
    lista.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in partes), encoding="utf-8")
    video = pasta / "video.mp4"
    subprocess.run([R.FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", str(video)], check=True)
    dur = float(subprocess.run([str(Path(R.FFMPEG).with_name(Path(R.FFMPEG).name.replace("ffmpeg", "ffprobe"))), "-v", "error", "-show_entries",
                                "format=duration", "-of", "csv=p=0", str(video)], capture_output=True, text=True).stdout.strip() or 0)
    auds = R.fonte_audio(html)
    cmd = [R.FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(video)]
    for p in auds: cmd += ["-i", str(p)]
    if len(auds) > 1:
        ent = "".join(f"[{i + 1}:a]" for i in range(len(auds)))
        cmd += ["-filter_complex", f"{ent}amix=inputs={len(auds)}:normalize=0:duration=longest,apad[a]", "-map", "0:v", "-map", "[a]"]
    elif auds:
        cmd += ["-filter_complex", "[1:a]apad[a]", "-map", "0:v", "-map", "[a]"]
    if auds: cmd += ["-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2"]
    cmd += ["-c:v", "copy", "-t", f"{dur:.3f}", "-movflags", "+faststart", str(saida)]
    subprocess.run(cmd, check=True)
    print(f"OK {saida} · {len(partes)} partes · {dur:.1f} s · áudio: {[p.name for p in auds]} · {saida.stat().st_size / 1e6:.0f} MB")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "planeja": planeja(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 30)
    elif cmd == "junta": junta(sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]) if len(sys.argv) > 5 else 30)
    else: sys.exit(__doc__)
