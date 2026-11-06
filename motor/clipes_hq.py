# -*- coding: utf-8 -*-
"""Roda NO PC DO IGOR (onde estão as fontes originais). Faz tudo sozinho:
1. Corta os 227 clipes do vídeo 001 do Elaborando (plano_takes_v2_video001.json) em alta qualidade
   (resolução original, máx. 1920 de largura, crf 14), com os mesmos nomes da prévia 720p.
2. Zipa e sobe na Release "clipes-hq-video001" deste repositório (igoralvesgta2026/gta-studio-render).
3. Dispara o workflow render3d.yml com esses clipes (render 1080p em 20 partes no GitHub Actions).
Uso: python -X utf8 motor/clipes_hq.py      (retoma se parar: pula clipes já feitos)
Token: GH_TOKEN/GITHUB_TOKEN, ou GITHUB_TOKEN= num .credenciais.env do Igor, ou `gh auth token`. Nunca é impresso.
"""
import json, os, shutil, subprocess, sys, time, urllib.request, urllib.error, zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

AQUI = Path(__file__).resolve().parent
REPO = "igoralvesgta2026/gta-studio-render"
TAG = "clipes-hq-video001"
OUT = AQUI.parent / "_clipes_hq"
LIMITE_ZIP = 1_900_000_000


def token():
    t = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if t: return t
    home = Path.home()
    for c in [home / "CANAIS YT GTA" / ".credenciais.env", home / "teste" / ".credenciais.env", home / ".credenciais.env"]:
        if c.exists():
            for l in c.read_text(encoding="utf-8-sig").splitlines():
                if l.strip().startswith("GITHUB_TOKEN="): return l.split("=", 1)[1].strip()
    try:
        return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()
    except Exception:
        sys.exit("sem token do GitHub (GH_TOKEN, .credenciais.env ou gh auth login)")


TOKEN = token()
H = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


def api(met, url, dados=None, ok404=False, cab=None, corpo=None):
    url = url if url.startswith("http") else "https://api.github.com" + url
    req = urllib.request.Request(url, method=met, headers={**H, **(cab or {})},
                                 data=corpo if corpo is not None else (json.dumps(dados).encode() if dados is not None else None))
    try:
        with urllib.request.urlopen(req, timeout=7200) as r:
            b = r.read(); return json.loads(b) if b and "json" in r.headers.get("Content-Type", "") else b
    except urllib.error.HTTPError as e:
        if ok404 and e.code == 404: return None
        sys.exit(f"API {met} {url.split('?')[0]} → {e.code}: {e.read()[:300]!r}")


def corta(i_tk):
    i, tk = i_tk; d = round(tk["b"] - tk["a"] + .3, 3)
    dst = OUT / f"{i + 1:03d}_{tk['cena']}.mp4"
    if dst.exists() and dst.stat().st_size > 0: return None
    tmp = dst.with_suffix(".tmp.mp4")
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(tk["src_ini"]), "-i", tk["arquivo"], "-t", str(d), "-an",
                        "-vf", "scale='min(1920,iw)':-2:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(tmp)], capture_output=True, text=True)
    if r.returncode: return f"FALHOU {dst.name}: {r.stderr[-300:]}"
    tmp.replace(dst); return None


def main():
    plano = json.loads((AQUI / "plano_takes_v2_video001.json").read_text(encoding="utf8"))["takes"]
    faltam = sorted({tk["arquivo"] for tk in plano if not Path(tk["arquivo"]).exists()})
    if faltam: sys.exit("FONTES FALTANDO:\n" + "\n".join(faltam))
    if not shutil.which("ffmpeg"): sys.exit("ffmpeg não encontrado no PATH")
    OUT.mkdir(exist_ok=True)
    t0 = time.time(); feitos = [0]
    def um(x):
        r = corta(x); feitos[0] += 1
        if feitos[0] % 20 == 0: print(f"  {feitos[0]}/{len(plano)} clipes ({(time.time() - t0) / 60:.1f} min)", flush=True)
        return r
    with ThreadPoolExecutor(4) as ex: falhas = [x for x in ex.map(um, enumerate(plano)) if x]
    arqs = sorted(OUT.glob("[0-9][0-9][0-9]_*.mp4"))
    print(f"{len(arqs)} clipes; {len(falhas)} falhas", flush=True)
    for f in falhas: print(f)
    if falhas or len(arqs) != len(plano): sys.exit(1)

    # zips (≤ 1,9 GB cada)
    grupos, g, tam = [], [], 0
    for f in arqs:
        if g and tam + f.stat().st_size > LIMITE_ZIP: grupos.append(g); g, tam = [], 0
        g.append(f); tam += f.stat().st_size
    grupos.append(g)
    zips = []
    for k, g in enumerate(grupos, 1):
        z = AQUI.parent / f"clipes-hq-{k}.zip"
        with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
            for f in g: zf.write(f, f.name)
        zips.append(z); print(f"{z.name}: {len(g)} clipes, {z.stat().st_size / 1e6:.0f} MB", flush=True)

    # release (recria do zero)
    rel = api("GET", f"/repos/{REPO}/releases/tags/{TAG}", ok404=True)
    if rel:
        api("DELETE", f"/repos/{REPO}/releases/{rel['id']}"); api("DELETE", f"/repos/{REPO}/git/refs/tags/{TAG}", ok404=True)
    rel = api("POST", f"/repos/{REPO}/releases", {"tag_name": TAG, "name": "Clipes HQ · vídeo 001 Elaborando",
                                                  "body": f"{len(arqs)} clipes do plano_takes_v2, resolução original (máx. 1920), crf 14", "prerelease": True})
    up = rel["upload_url"].split("{")[0]
    for z in zips:
        print(f"enviando {z.name}...", flush=True)
        with open(z, "rb") as fh:
            api("POST", f"{up}?name={z.name}", cab={"Content-Type": "application/zip", "Content-Length": str(z.stat().st_size)}, corpo=fh)
        z.unlink()
    print(f"release: {rel['html_url']}", flush=True)

    # dispara o render 1080p com os clipes HQ
    api("POST", f"/repos/{REPO}/actions/workflows/render3d.yml/dispatches",
        {"ref": "main", "inputs": {"clipes": TAG, "nome": "elaborando_video001-3d_1080p_hq"}})
    time.sleep(8)
    run = api("GET", f"/repos/{REPO}/actions/workflows/render3d.yml/runs?per_page=1")["workflow_runs"][0]
    print(f"RENDER DISPARADO: {run['html_url']}")
    print("PRONTO: 227 clipes HQ enviados e render disparado.")


if __name__ == "__main__":
    main()
