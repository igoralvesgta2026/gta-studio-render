# -*- coding: utf-8 -*-
"""Renderiza um vídeo HTML do GTA-Studio em MP4 de qualidade máxima (imagem + áudio final).

Uso:
  python -X utf8 motor/renderiza.py <html> [--fps 30|60] [--de S --ate S] [--saida arquivo.mp4] [--partes N] [--status arquivo.json] [--formato png|jpeg]

Como funciona (determinístico, não depende da velocidade da máquina):
- Abre a página no Chrome headless (Playwright, sempre --mute-audio) em ?rec=1, viewport = tamanho nativo do palco (W×H do
  script, padrão 1920×1080), deviceScaleFactor 1, palco em escala 1 e sem bordas/interface.
- Um script de início troca o relógio da página por um relógio virtual (performance.now, Date.now, requestAnimationFrame),
  então o gsap.ticker só anda quando o renderizador manda. A cada quadro: clock = t, roda o ticker uma vez (a mesma lógica de
  desenho do player), avança animações/transições CSS pelo mesmo relógio, força o currentTime exato de todo <video> e espera
  'seeked' antes de capturar. O corte de luz (wipe) entre cenas é disparado como no player tocando.
- Quadros PNG vão por pipe para o ffmpeg (libx264 -crf 13 -preset slow, yuv420p BT.709, +faststart). O trecho é dividido em
  N partes (em limites de cena quando dá) renderizadas em paralelo e unidas sem reencodar; o áudio (mix_final.mp3 ou a
  mistura de narração+música+sfx) entra em AAC 320k, cortado igual ao trecho.
- Progresso em JSON (quadros feitos/total, quadros/s, ETA) em <saida>.status.json (ou --status).
"""
import argparse, base64, json, math, os, queue, re, shutil, subprocess, sys, threading, time
from datetime import datetime
from pathlib import Path

FFMPEG = r"C:\Users\Alves\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
if not Path(FFMPEG).exists():
    FFMPEG = shutil.which("ffmpeg") or FFMPEG
RAIZ = Path(__file__).resolve().parent.parent
CRF = 13

# ---------------------------------------------------------------- JS injetado antes de qualquer script da página
INIT_JS = r"""
(() => {
  const R = window.__R = { vt: 0, raf: [], seeks: new Set(), anims: new WeakMap(), ativo: true };
  const BASE = 1767225600000;
  const agoraReal = performance.now.bind(performance);   // relógio de verdade (prazos de espera)
  R.prazo = Infinity; R.diag = [];
  try { performance.now = () => R.vt; } catch (e) { Object.defineProperty(performance, 'now', { value: () => R.vt }); }
  Date.now = () => BASE + R.vt;
  let rid = 0;
  R.rafReal = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { const i = ++rid; R.raf.push([i, cb]); return i; };
  window.cancelAnimationFrame = i => { R.raf = R.raf.filter(x => x[0] !== i); };
  // aleatório com semente (reiniciada a cada cena -> partes paralelas desenham igual ao render contínuo)
  let s = 20260101;
  Math.random = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  R.semente = n => { s = (n + 1) * 2654435761 | 0; };
  // <video>: o player só reposiciona quando a diferença passa de ~0,05 s; aqui o getter mente para ele SEMPRE gravar o
  // tempo exato de cada quadro, e o setter guarda quem precisa de 'seeked' antes da captura.
  const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', { configurable: true,
    get() { return R.ativo ? -1e6 : d.get.call(this); },
    set(v) { if (!R.ativo) return d.set.call(this, v);
      if (!isFinite(v)) return;
      if (this.__alvo !== undefined && Math.abs(this.__alvo - v) < 1e-4) return;
      this.__alvo = v; d.set.call(this, v); R.seeks.add(this); } });
  // ...e o player nunca "vê" um seek em andamento (senão pula a gravação do tempo do quadro seguinte)
  const dSk = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'seeking');
  Object.defineProperty(HTMLVideoElement.prototype, 'seeking', { configurable: true, get() { return R.ativo ? false : dSk.get.call(this); } });
  const busy = v => dSk.get.call(v);
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { return R.ativo ? Promise.resolve() : play.call(this); };
  const G = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };
  R.G = G;
  const espera = (el, ev, ms) => new Promise(ok => { const t0 = agoraReal(); ms = Math.max(0, Math.min(ms, R.prazo - t0));
    if (ms <= 0) { R.diag.push('sem prazo:' + ev); return ok(); }
    const ok0 = ok; ok = () => { const d = agoraReal() - t0; if (d > 400) R.diag.push(ev + ' ' + Math.round(d) + 'ms ' + String(el.currentSrc || el.src || '').slice(-28)); ok0(); }; let f = false; const fim = () => { if (!f) { f = true; ok(); } };
    el.addEventListener(ev, fim, { once: true }); setTimeout(fim, ms); });
  const rodaRaf = () => { const q = R.raf; R.raf = []; for (const [, cb] of q) { try { cb(R.vt); } catch (e) { console.error('raf', e); } } };
  const css = () => { for (const a of document.getAnimations()) { if (a.playState === 'idle') continue;
      let st = R.anims.get(a); if (st === undefined) { st = R.vt - (a.currentTime || 0); R.anims.set(a, st); try { a.pause(); } catch (e) {} }
      try { a.currentTime = R.vt - st; } catch (e) {} } };
  R.prepara = (W, H) => {
    const st = document.getElementById('stage');
    const sty = document.createElement('style');
    sty.textContent = `html,body{overflow:hidden!important;background:#000!important}
      [data-render-vp]{position:fixed!important;left:0!important;top:0!important;width:${W}px!important;height:${H}px!important;
        margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;z-index:2147483646!important;background:#000!important}
      #stage{transform:none!important;left:0!important;top:0!important}
      #capa{display:none!important}
      ::-webkit-scrollbar{display:none}`;
    document.head.appendChild(sty);
    if (st && st.parentElement && st.parentElement !== document.body) st.parentElement.setAttribute('data-render-vp', '');
    else if (st) st.setAttribute('data-render-vp', '');
    try { G('pausa')(); } catch (e) {}
    try { gsap.ticker.lagSmoothing(0); } catch (e) {}
    const mb = G('montaBeat');
    if (typeof mb === 'function' && !mb.__render) {
      const f = function (i) { R.semente(i); return mb.apply(this, arguments); }; f.__render = true; window.montaBeat = f;
    }
    try { G('fit') && G('fit')(); } catch (e) {}
    const B = G('BEATS');
    return { total: G('TOTAL') || null, beats: Array.isArray(B) ? B.map(b => b.de) : [], temClock: G('clock') !== undefined };
  };
  R.setClock = t => { try { (0, eval)('clock=' + t); } catch (e) {} };
  // um quadro: clock=t, ticker, wipe, CSS, vídeos no tempo certo
  // cada quadro tem no máximo PRAZO ms de espera somada (mídia lenta nunca trava o render em silêncio)
  R.passo = async (t, dt, captura, PRAZO = 12000) => {
    R.diag = []; R.prazo = agoraReal() + PRAZO;
    const b0 = G('curB');
    R.setClock(t);
    R.vt += dt * 1000;
    rodaRaf();
    const b1 = G('curB'), B = G('BEATS');
    if (R.jaRodou && b1 !== b0 && b0 >= 0 && b1 === b0 + 1 && B && B[b1] && B[b1].corte && typeof G('wipe') === 'function') {
      try { G('wipe')(); gsap.ticker.tick(); } catch (e) {}
    }
    R.jaRodou = true;
    css();
    if (!captura) return 0;
    const stage = document.getElementById('stage') || document.body;
    const vis = [...stage.querySelectorAll('video')].filter(v => v.getClientRects().length);
    let recarrega = false;
    for (const v of vis) if (v.readyState < 1) { await espera(v, 'loadedmetadata', 15000); recarrega = true; }
    for (const im of stage.querySelectorAll('img')) { if (!im.complete) { await espera(im, 'load', 8000); } }
    if (recarrega) { try { gsap.ticker.tick(); } catch (e) {} }
    // espera cada <video> chegar EXATAMENTE no tempo pedido (um 'seeked' antigo pode chegar antes do último pedido)
    const pend = [...R.seeks]; R.seeks.clear();
    const real = v => d.get.call(v);
    for (const v of pend) {
      const alvo = isFinite(v.duration) ? Math.min(v.__alvo, v.duration) : v.__alvo; let n = 0;
      while ((busy(v) || Math.abs(real(v) - alvo) > 0.002) && n++ < 20) {
        if (!busy(v)) { d.set.call(v, v.__alvo); }
        await espera(v, 'seeked', 500);
      }
    }
    for (const v of vis) if (v.readyState < 2) await espera(v, 'canplay', 3000);
    if (!R.assentou) {   // 1º quadro capturado: deixa o compositor assentar
      R.assentou = true;
      for (let i = 0; i < 3; i++) await new Promise(ok => { const to = setTimeout(ok, 100); R.rafReal(() => { clearTimeout(to); ok(); }); });
    }
    R.prazo = Infinity;
    return R.diag.length ? R.diag.join(' | ') : '';
  };
})();
"""


def le_dim(html_txt):
    m = re.search(r"\bW\s*=\s*(\d{3,4})\s*,\s*H\s*=\s*(\d{3,4})", html_txt)
    return (int(m.group(1)), int(m.group(2))) if m else (1920, 1080)


def grava_json(p, d):
    p = Path(p); tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    for _ in range(20):
        try:
            os.replace(tmp, p); return
        except PermissionError:
            time.sleep(0.05)


def abre_pagina(pw, html, W, H):
    args = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--force-color-profile=srgb",
            "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
            "--allow-file-access-from-files"]
    browser = None
    for canal in ("chrome", "msedge", None):   # Chrome/Edge têm H.264 (o Chromium do Playwright não decodifica mp4)
        try:
            browser = pw.chromium.launch(channel=canal, headless=True, args=args) if canal else pw.chromium.launch(headless=True, args=args)
            break
        except Exception:
            continue
    ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    ctx.add_init_script(INIT_JS)
    page = ctx.new_page()
    page.on("pageerror", lambda e: print("[pagina] erro:", e, file=sys.stderr))
    url = Path(html).resolve().as_uri() + "?rec=1"
    page.goto(url, wait_until="domcontentloaded", timeout=120000)
    try:   # 'load' espera todos os clipes com preload; não trava o render se algum demorar
        page.wait_for_function("document.readyState==='complete'", timeout=45000)
    except Exception:
        print("aviso: a página não terminou de carregar em 45 s; seguindo assim mesmo", file=sys.stderr)
    page.evaluate("document.fonts.ready.then(()=>1)")
    time.sleep(1.2)          # imagens de fundo / clipes começam a carregar
    info = page.evaluate(f"__R.prepara({W},{H})")
    page.evaluate("document.fonts.ready.then(()=>1)")
    return browser, page, info


# ---------------------------------------------------------------- trabalhador: renderiza quadros [f0,f1) num mp4 sem áudio
def trabalhador(a):
    from playwright.sync_api import sync_playwright
    html = Path(a.html); W, H = le_dim(html.read_text(encoding="utf-8", errors="ignore"))
    fps = a.fps; f0, f1 = a.f0, a.f1; n = f1 - f0
    st = {"feitos": 0, "total": n, "fase": "abrindo", "inicio": time.time()}
    grava_json(a.status, st)
    threads = str(max(2, (os.cpu_count() or 8) // max(1, a.partes)))
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg" if a.formato == "jpeg" else "png", "-i", "-",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p",
           "-c:v", "libx264", "-preset", os.environ.get("RENDER_PRESET", "slow"), "-crf", os.environ.get("RENDER_CRF", str(CRF)), "-threads", threads, "-pix_fmt", "yuv420p",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-r", str(fps), "-movflags", "+faststart", a.saida]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    fila = queue.Queue(maxsize=24)

    def escritor():
        while True:
            b = fila.get()
            if b is None: break
            ff.stdin.write(base64.b64decode(b))
        ff.stdin.close()
    th = threading.Thread(target=escritor, daemon=True); th.start()
    with sync_playwright() as pw:
        browser, page, info = abre_pagina(pw, html, W, H)
        if not info.get("temClock"):
            print("aviso: a página não tem a global 'clock' — o render pode não seguir o tempo", file=sys.stderr)
        cdp = page.context.new_cdp_session(page)
        dt = 1.0 / fps
        t_ini = a.de + f0 / fps
        # pré-rolagem: até 1 s antes (sem capturar) para rastro, legenda e corte entrarem como no contínuo
        pre = int(round(min(1.0, t_ini) * fps))
        st["fase"] = "pre-rolagem"; grava_json(a.status, st)
        for k in range(pre, 0, -1):
            page.evaluate("([t,d])=>__R.passo(t,d,false)", [t_ini - k * dt, dt])
        st["fase"] = "renderizando"; st["inicio_quadros"] = time.time(); grava_json(a.status, st)
        ultimo = 0
        clip = {"x": 0, "y": 0, "width": W, "height": H, "scale": 1}
        fmt = {"format": "jpeg", "quality": 100} if a.formato == "jpeg" else {"format": "png", "optimizeForSpeed": True}
        for k in range(n):
            t = a.de + (f0 + k) / fps
            t_q = time.time()
            diag = page.evaluate("([t,d])=>__R.passo(t,d,true)", [t, dt])
            if diag or time.time() - t_q > 3:
                print(f"[parte f{f0}] quadro {f0 + k} (t={t:.2f}s) levou {time.time() - t_q:.1f}s: {diag}", file=sys.stderr)
            r = cdp.send("Page.captureScreenshot", {**fmt, "clip": clip, "captureBeyondViewport": False})
            fila.put(r["data"])
            st["feitos"] = k + 1
            if time.time() - ultimo > 0.7:
                grava_json(a.status, st); ultimo = time.time()
        browser.close()
    fila.put(None); th.join(); rc = ff.wait()
    st["fase"] = "pronto" if rc == 0 else "erro"; st["feitos"] = n; st["rc"] = rc
    grava_json(a.status, st)
    sys.exit(rc)


# ---------------------------------------------------------------- áudio
def fonte_audio(html):
    pasta = html.parent
    if (pasta / "mix_final.mp3").exists():
        return [pasta / "mix_final.mp3"]
    txt = html.read_text(encoding="utf-8", errors="ignore")
    achados = [pasta / s for s in dict.fromkeys(re.findall(r"new Audio\(\s*['\"]([^'\"]+)['\"]", txt))]
    achados = [p for p in achados if p.exists()]
    if not achados:
        achados = [pasta / f for f in ("narracao.mp3", "musica.mp3", "sfx.mp3") if (pasta / f).exists()]
    return achados


def nome_padrao(html):
    html = html.resolve()
    try:
        rel = html.relative_to(RAIZ / "videos").parts
        nome = "_".join(list(rel[:-1]) + ([] if html.stem == "index" else [html.stem]))
    except ValueError:
        nome = html.parent.name + ("" if html.stem == "index" else "_" + html.stem)
    nome = re.sub(r"[^\w.-]+", "-", nome).strip("-_") or "video"
    return html.parent / "render" / f"{nome}_{datetime.now():%Y-%m-%d_%H%M}.mp4"


def divide(F, N, fps, de, beats):
    """Fronteiras de quadros [0..F] em N partes, puxadas para o início de cena mais próximo quando perto."""
    bf = sorted({int(round((b - de) * fps)) for b in beats if 0 < (b - de) * fps < F})
    cortes = [0]
    for i in range(1, N):
        alvo = round(F * i / N); tol = F / N * 0.2
        perto = [b for b in bf if abs(b - alvo) <= tol and b > cortes[-1]]
        c = min(perto, key=lambda b: abs(b - alvo)) if perto else alvo
        if c > cortes[-1]: cortes.append(c)
    cortes.append(F)
    return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1) if cortes[i + 1] > cortes[i]]


def principal(a):
    html = Path(a.html).resolve()
    if not html.exists():
        sys.exit(f"não achei {html}")
    saida = Path(a.saida).resolve() if a.saida else nome_padrao(html)
    saida.parent.mkdir(parents=True, exist_ok=True)
    stp = Path(a.status) if a.status else saida.with_suffix(".status.json")
    S = {"estado": "iniciando", "html": str(html), "saida": str(saida), "fps": a.fps, "quadros": 0, "total": 0, "pct": 0,
         "qps": 0, "eta_s": None, "decorrido_s": 0, "inicio": datetime.now().isoformat(timespec="seconds"), "mensagem": "abrindo a página", "pid": os.getpid()}
    grava_json(stp, S)
    t0 = time.time()
    try:
        from playwright.sync_api import sync_playwright
        W, H = le_dim(html.read_text(encoding="utf-8", errors="ignore"))
        with sync_playwright() as pw:          # sonda: duração total e inícios de cena
            b, page, info = abre_pagina(pw, html, W, H); b.close()
        total = float(info.get("total") or 0)
        de = max(0.0, a.de or 0.0)
        ate = a.ate if a.ate is not None else total
        if not ate or ate <= de:
            raise RuntimeError("não deu para saber a duração (use --ate)")
        if total: ate = min(ate, total)
        F = int(round((ate - de) * a.fps))
        N = a.partes or max(1, min(6, (os.cpu_count() or 4) // 4))   # medido: 4 partes ≈ 7 q/s; 8 juntas travam a carga das páginas
        N = max(1, min(N, math.ceil(F / (a.fps * 8))))      # cada parte com pelo menos ~8 s
        partes = divide(F, N, a.fps, de, info.get("beats") or [])
        tmp = saida.parent / (saida.stem + ".partes"); tmp.mkdir(exist_ok=True)
        S.update(estado="renderizando", total=F, de=de, ate=ate, largura=W, altura=H, partes=len(partes),
                 mensagem=f"{len(partes)} parte(s) em paralelo")
        grava_json(stp, S)
        procs = []
        for i, (f0, f1) in enumerate(partes):
            ps, pst = tmp / f"p{i:02d}.mp4", tmp / f"p{i:02d}.json"
            cmd = [sys.executable, "-X", "utf8", str(Path(__file__).resolve()), str(html), "--_trabalhador", "--fps", str(a.fps),
                   "--de", str(de), "--f0", str(f0), "--f1", str(f1), "--saida", str(ps), "--status", str(pst), "--partes", str(len(partes)), "--formato", a.formato]
            procs.append({"p": subprocess.Popen(cmd), "ps": ps, "pst": pst, "cmd": cmd, "tent": 1})
            time.sleep(1.5)        # abre os navegadores escalonados (8 abrindo juntos disputam disco/CPU)
        t_quadros = None
        while True:
            for w in procs:        # parte que falhou: tenta de novo (até 3 vezes)
                rc = w["p"].poll()
                if rc not in (None, 0):
                    if w["tent"] >= 3:
                        for x in procs:
                            if x["p"].poll() is None: x["p"].kill()
                        raise RuntimeError(f"a parte {w['ps'].stem} falhou 3 vezes (veja o terminal)")
                    print(f"parte {w['ps'].stem} falhou (código {rc}); tentando de novo", file=sys.stderr)
                    w["tent"] += 1; w["p"] = subprocess.Popen(w["cmd"])
            vivos = [w for w in procs if w["p"].poll() is None]
            feitos = 0; ini = []
            for w in procs:
                try:
                    d = json.loads(w["pst"].read_text(encoding="utf-8")); feitos += d.get("feitos", 0)
                    if d.get("inicio_quadros"): ini.append(d["inicio_quadros"])
                except Exception:
                    pass
            if ini and t_quadros is None: t_quadros = min(ini)
            el = time.time() - (t_quadros or time.time())
            qps = feitos / el if el > 1 and feitos else 0
            S.update(quadros=feitos, pct=round(100 * feitos / max(1, F), 1), qps=round(qps, 2),
                     eta_s=round((F - feitos) / qps + 3, 0) if qps else None, decorrido_s=round(time.time() - t0, 1))
            grava_json(stp, S)
            if not vivos and all(w["p"].returncode == 0 for w in procs): break
            time.sleep(1)
        procs = [(w["p"], w["ps"], w["pst"]) for w in procs]
        S.update(estado="juntando", mensagem="unindo as partes e o áudio", eta_s=5); grava_json(stp, S)
        lista = tmp / "lista.txt"
        lista.write_text("".join(f"file '{ps.as_posix()}'\n" for _, ps, _ in procs), encoding="utf-8")
        so_video = tmp / "video.mp4"
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lista),
                        "-c", "copy", str(so_video)], check=True)
        dur = F / a.fps
        auds = fonte_audio(html)
        cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(so_video)]
        for p in auds: cmd += ["-ss", f"{de:.3f}", "-t", f"{dur:.3f}", "-i", str(p)]
        if len(auds) > 1:
            ent = "".join(f"[{i + 1}:a]" for i in range(len(auds)))
            cmd += ["-filter_complex", f"{ent}amix=inputs={len(auds)}:normalize=0:duration=longest,apad[a]", "-map", "0:v", "-map", "[a]"]
        elif auds:
            cmd += ["-filter_complex", "[1:a]apad[a]", "-map", "0:v", "-map", "[a]"]
        if auds: cmd += ["-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2"]
        cmd += ["-c:v", "copy", "-t", f"{dur:.3f}", "-movflags", "+faststart", str(saida)]
        subprocess.run(cmd, check=True)
        shutil.rmtree(tmp, ignore_errors=True)
        el = time.time() - t0
        S.update(estado="pronto", quadros=F, pct=100, eta_s=0, decorrido_s=round(el, 1),
                 audio=[p.name for p in auds], tamanho_mb=round(saida.stat().st_size / 1e6, 1),
                 mensagem=f"pronto em {el / 60:.1f} min")
        grava_json(stp, S)
        print(f"OK {saida}  ({F} quadros, {el:.0f} s, {F / max(el, 1):.1f} quadros/s no total)")
    except Exception as e:
        S.update(estado="erro", mensagem=str(e)); grava_json(stp, S)
        print("ERRO:", e, file=sys.stderr); sys.exit(1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Renderiza o vídeo HTML em MP4 (qualidade máxima).")
    ap.add_argument("html")
    ap.add_argument("--fps", type=int, default=30, choices=[24, 25, 30, 50, 60])
    ap.add_argument("--de", type=float, default=0.0)
    ap.add_argument("--ate", type=float, default=None)
    ap.add_argument("--saida")
    ap.add_argument("--partes", type=int, default=0)
    ap.add_argument("--status")
    ap.add_argument("--formato", choices=["png", "jpeg"], default="png",
                    help="captura de cada quadro: png (sem perda, padrão) ou jpeg q100 (~1,7x mais rápido)")
    ap.add_argument("--_trabalhador", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--f0", type=int, default=0, help=argparse.SUPPRESS)
    ap.add_argument("--f1", type=int, default=0, help=argparse.SUPPRESS)
    a = ap.parse_args()
    trabalhador(a) if a._trabalhador else principal(a)
