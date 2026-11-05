# -*- coding: utf-8 -*-
"""Renderiza o vídeo 001 3D (player video001-3d/index.html) em MP4 1080p.

Uso:
  python -X utf8 scripts/renderiza_3d.py [--de 0] [--ate 586.016] [--fps 30] [--partes 4] [--saida arquivo.mp4]

- Precisa do servidor com Range na 3930 (servidor_range.py servindo estilo/); sobe sozinho se não estiver no ar.
- Cada parte = um Chrome headless MUDO em ?t=, quadro a quadro via Motor.renderEm(T) (determinístico, espera mídia).
- Quadros JPEG q100 → ffmpeg libx264 crf 16. Áudio = narração + sfx dos blocos (mesma regra do player) em AAC 320k.
"""
import argparse, base64, json, math, os, shutil, socket, subprocess, sys, time, urllib.request
from pathlib import Path

ESTILO = Path(os.environ.get("RENDER_ESTILO") or Path(__file__).resolve().parents[1] / "canais" / "elaborando-gta" / "estilo")
PASTA = ESTILO / "video001-3d"
SERVIDOR = Path(os.environ.get("RENDER_SERVIDOR") or r"E:\Projetos\Alves Academy\GTA-Studio\scripts\servidor_range.py")
PORTA = 3930
URL = f"http://localhost:{PORTA}/video001-3d/index.html"
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
DUR = 586.016


def servidor_no_ar():
    try:
        urllib.request.urlopen(f"http://localhost:{PORTA}/video001-3d/SPEC.md", timeout=3); return True
    except Exception:
        return False


def garante_servidor():
    if servidor_no_ar(): return
    subprocess.Popen([sys.executable, "-I", str(SERVIDOR), str(ESTILO), str(PORTA)],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    for _ in range(50):
        time.sleep(0.2)
        if servidor_no_ar(): return
    sys.exit("servidor 3930 não subiu")


def trabalhador(f0, f1, fps, saida, crf, preset, status):
    from playwright.sync_api import sync_playwright
    args = ["--mute-audio", "--hide-scrollbars", "--force-color-profile=srgb", "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]
    ff = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", str(fps), "-i", "-",
                           "-c:v", "libx264", "-crf", str(crf), "-preset", preset, "-pix_fmt", "yuv420p",
                           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-r", str(fps), str(saida)],
                          stdin=subprocess.PIPE)
    sfx, venceu = {}, []
    with sync_playwright() as pw:
        br = pw.chromium.launch(channel="chrome", headless=True, args=args)
        pg = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1).new_page()
        pg.on("console", lambda m: m.type == "error" and print(f"[pág {f0}] {m.text}", flush=True))
        pg.goto(f"{URL}?t={f0 / fps:.4f}", wait_until="load")
        pg.wait_for_function("document.body.dataset.pronto === '1'", timeout=120000)
        cdp = pg.context.new_cdp_session(pg)
        t0 = time.time()
        for f in range(f0, f1):
            T = f / fps
            r = pg.evaluate("T => Motor.renderEm(T)", T)
            if r["venceu"]: venceu.append(round(T, 3))
            for s in r["sfx"]: sfx[f"{s[0]:.4f}|{s[1]}"] = s
            img = cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 100, "optimizeForSpeed": True})["data"]
            ff.stdin.write(base64.b64decode(img))
            n = f - f0 + 1
            if n % 30 == 0 or f == f1 - 1:
                el = time.time() - t0
                status.write_text(json.dumps({"feitos": n, "total": f1 - f0, "qps": round(n / el, 2),
                                              "eta_min": round((f1 - f0 - n) / (n / el) / 60, 1), "timeouts": len(venceu)}), encoding="utf-8")
        br.close()
    ff.stdin.close(); ff.wait()
    (Path(str(saida) + ".sfx.json")).write_text(json.dumps({"sfx": list(sfx.values()), "timeouts": venceu}), encoding="utf-8")


def mixa_audio(sfx, de, ate, saida):
    narr = ESTILO / "video001" / "narracao_v2.mp3"
    eventos = []
    for abs_, nome, vol, a, b in sfx:
        if not (a - 0.25 < abs_ < b): continue          # mesma janela do player (toca ao cruzar, dentro do bloco atual)
        t = max(abs_, a)
        if de <= t < ate: eventos.append((t - de, nome, float(vol)))
    eventos.sort()
    ins = ["-ss", f"{de:.3f}", "-t", f"{ate - de:.3f}", "-i", str(narr)]
    filt, rot = [], ["[0:a]"]
    for k, (t, nome, vol) in enumerate(eventos, 1):
        ins += ["-i", str(ESTILO / "sfx" / f"{nome.replace('.mp3', '')}.mp3")]
        ms = int(round(t * 1000))
        filt.append(f"[{k}:a]volume={vol:.3f},adelay={ms}|{ms}[s{k}]"); rot.append(f"[s{k}]")
    filt.append(f"{''.join(rot)}amix=inputs={len(rot)}:normalize=0:duration=first[a]")
    fc = Path(str(saida) + ".filtro.txt"); fc.write_text(";".join(filt), encoding="utf-8")
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", *ins, "-filter_complex_script", str(fc), "-map", "[a]",
                    "-c:a", "pcm_s16le", "-ar", "48000", str(saida)], check=True)
    return len(eventos)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--de", type=float, default=0); ap.add_argument("--ate", type=float, default=DUR)
    ap.add_argument("--fps", type=int, default=30); ap.add_argument("--partes", type=int, default=4)
    ap.add_argument("--crf", type=int, default=16); ap.add_argument("--preset", default="medium")
    ap.add_argument("--saida", default=str(PASTA / "render" / "video001-3d_1080p.mp4"))
    ap.add_argument("--_trab", nargs=3)  # f0 f1 arquivo
    ap.add_argument("--junta")           # pasta com parte_*.mp4 (+ .sfx.json) → saída final
    a = ap.parse_args()
    if a.junta:
        ps = sorted((p.resolve() for p in Path(a.junta).glob("parte_*.mp4")), key=lambda p: int(p.stem.split("_")[2]))
        junta(ps, Path(a.saida).resolve(), int(ps[0].stem.split("_")[2]) / a.fps, int(ps[-1].stem.split("_")[3]) / a.fps); return
    if a._trab:
        f0, f1, arq = int(a._trab[0]), int(a._trab[1]), Path(a._trab[2])
        garante_servidor()
        trabalhador(f0, f1, a.fps, arq, a.crf, a.preset, Path(str(arq) + ".status.json")); return

    garante_servidor()
    saida = Path(a.saida).resolve(); tmp = saida.parent / "_partes"; tmp.mkdir(parents=True, exist_ok=True)
    F0, F1 = int(round(a.de * a.fps)), int(math.floor(a.ate * a.fps))
    passo = math.ceil((F1 - F0) / a.partes)
    procs, partes = [], []
    for k in range(a.partes):
        f0, f1 = F0 + k * passo, min(F1, F0 + (k + 1) * passo)
        if f0 >= f1: break
        arq = tmp / f"parte_{k:02d}_{f0}_{f1}.mp4"; partes.append(arq)
        if arq.exists() and Path(str(arq) + ".sfx.json").exists():
            print(f"parte {k} já feita, pulando", flush=True); continue
        procs.append(subprocess.Popen([sys.executable, "-X", "utf8", __file__, "--fps", str(a.fps), "--crf", str(a.crf),
                                       "--preset", a.preset, "--_trab", str(f0), str(f1), str(arq)]))
    t0 = time.time()
    while any(p.poll() is None for p in procs):
        time.sleep(10 if F1 - F0 < 600 else 30)
        st = []
        for arq in partes:
            s = Path(str(arq) + ".status.json")
            st.append(json.loads(s.read_text(encoding="utf-8")) if s.exists() else {})
        feitos = sum(x.get("feitos", 0) for x in st); tot = F1 - F0
        print(f"[{(time.time() - t0) / 60:.1f} min] {feitos}/{tot} quadros ({100 * feitos / tot:.1f}%) · "
              + " | ".join(f"{x.get('qps', 0)} q/s eta {x.get('eta_min', '?')}m" for x in st), flush=True)
    if any(p.returncode for p in procs): sys.exit("alguma parte falhou")

    junta(partes, saida, F0 / a.fps, F1 / a.fps)
    print(f"min: {round((time.time() - t0) / 60, 1)}")


def junta(partes, saida, de, ate):
    tmp = Path(saida).resolve().parent / "_partes"; tmp.mkdir(parents=True, exist_ok=True)
    sfx, tos = [], []
    for arq in partes:
        d = json.loads(Path(str(arq) + ".sfx.json").read_text(encoding="utf-8")); sfx += d["sfx"]; tos += d["timeouts"]
    lst = tmp / "lista.txt"; lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in partes), encoding="utf-8")
    video = tmp / "video.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(video)], check=True)
    wav = tmp / "audio.wav"
    n = mixa_audio(sfx, de, ate, wav)
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(video), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart", str(saida)], check=True)
    print(json.dumps({"saida": str(saida), "sfx": n, "timeouts": tos[:20], "n_timeouts": len(tos)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
