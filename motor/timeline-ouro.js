/* =====================================================================
   GTA-Studio · TIMELINE OURO v2 — timeline de editor embaixo do player dos vídeos em HTML
   ---------------------------------------------------------------------
   Incluir DEPOIS do <script> do player (motor/timeline_ouro.py → inclui_timeline()).
   Só LÊ o player: BEATS, TOTAL, clock, playing, audio e chama vaiPara()/toca()/pausa().
   O áudio da voz continua sendo o relógio; o palco não é tocado.
   Dados: BEATS · window.FRASES · window.PAL · window.SFX_EVENTOS (ou sfx.json) · window.ONDA (ou Web Audio).

   Faixas: régua (timecode 30 fps) · V1 Cenas · T1 Frases · T2 Palavras · FX Efeitos · A1 Voz (onda) + minimapa.
   ZOOM horizontal: Ctrl+roda (no ponto do mouse) · slider · + / − · \ ou Shift+Z = ajustar · até ver cada palavra e quadro.
   ALTURA: Alt+roda · slider ↕ · arrastar a alça de baixo · clique no nome da faixa recolhe/expande.
   Navegação: clique/arraste na régua ou nas faixas = pular · roda = rolar · minimapa = arrastar a janela
              [ ] = cena anterior/próxima · Home/End · Enter no bloco selecionado = ir pro início dele.
   Clique num bloco = detalhes (tempo exato, ID, JSON) + Copiar. ?rec=1 = timeline some.
   ===================================================================== */
(function () {
  "use strict";
  const REC = /[?&]rec=1\b/.test(location.search);
  const MINI = /[?&]tlprev=1\b/.test(location.search);   // a própria página dentro da janelinha de prévia dos efeitos
  const PV_ANTES = .35, PV_DEPOIS = 1.3;                  // trecho mostrado em loop em volta do efeito
  const G = (n) => { try { return eval(n); } catch (e) { return undefined; } };   // lê let/const globais do player
  const cena = () => G("BEATS") || [];
  const total = () => +G("TOTAL") || (cena().length ? cena()[cena().length - 1].ate : 60) || 60;
  const agora = () => +G("clock") || 0;
  const tocando = () => !!G("playing");
  const pular = (t) => { const f = G("vaiPara"); if (typeof f === "function") f(Math.max(0, Math.min(total() - 0.01, t))); };
  const playPause = () => { const f = G(tocando() ? "pausa" : "toca"); if (typeof f === "function") f(); };
  const FPS = 30, ZMAX = 1500;

  const raiz = getComputedStyle(document.documentElement);
  const COR = (raiz.getPropertyValue("--ouro") || "").trim() || "#F6B13D";
  const SFXCOR = { corte: "#7aa2ff", popIn: "#5ee08a", pop: "#5ee08a", "pop meme": "#5ee08a", pilIn: "#cfd5df", trava: "#ff3b4e", riser: "#c78bff",
    soca: "#ff8a3d", impacto: "#ff8a3d", enche: "#3fd0d0", sobe: "#ffe29a", barraLuz: COR, desenha: "#9ad0ff", cai: "#ff9db0",
    scanner: "#7fd6ff", spam: "#ff6b6b", zoomTo: "#b4f06c", whoosh: "#7aa2ff", "whoosh longo": "#5b7fff", "bipe SA": "#cfd5df", click: "#9aa3b0",
    "ui open": "#9ad0ff", "Arma som.m4a": "#ff3b4e", "CJ EFEITOS SONOROS.mp4": "#ffb000" };
  const corSfx = (t) => SFXCOR[t] || (/honra/i.test(t) ? "#ffd27a" : /money/i.test(t) ? "#5ee08a" : "#8a93a3");

  const FAIXAS = [ // chave, sigla, nome, altura base, cor
    ["regua", "", "", 28, ""],
    ["cenas", "V1", "Cenas", 42, COR],
    ["frases", "T1", "Frases", 34, "#8b6cff"],
    ["palavras", "T2", "Palavras", 30, "#7d8796"],
    ["motion", "MO", "Motion", 30, "#c78bff"],
    ["efeitos", "SFX", "Efeitos sonoros", 30, "#ff8a3d"],
    ["audio", "A1", "Voz", 70, "#2fbf71"],
  ];

  /* ---------------- CSS ---------------- */
  const css = `
#tlOuro{--vh:1;width:0;min-width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;margin-top:12px;background:#0c0e13;border:1px solid #1f242e;border-radius:12px;user-select:none;font-family:Inter,system-ui,sans-serif;color:#cfd5df;box-shadow:0 18px 40px rgba(0,0,0,.45)}
#tlOuro *{box-sizing:border-box}
#tlOuro .tb{display:flex;align-items:center;gap:8px;padding:8px 10px;background:linear-gradient(#151922,#11141b);border-bottom:1px solid #1f242e;flex-wrap:wrap}
#tlOuro .tc{font:700 20px/1 "JetBrains Mono",ui-monospace,Consolas,monospace;color:${COR};letter-spacing:.04em;padding:5px 10px;background:#07090c;border:1px solid #232934;border-radius:7px;min-width:150px;text-align:center;text-shadow:0 0 12px ${COR}55}
#tlOuro .tc small{font-size:11px;color:#6b7383;margin-left:6px;text-shadow:none}
#tlOuro .grp{display:flex;align-items:center;gap:3px;padding:2px;border:1px solid #232934;border-radius:8px;background:#0b0d12}
#tlOuro .bt{all:unset;cursor:pointer;min-width:26px;height:26px;padding:0 7px;display:grid;place-items:center;border-radius:6px;color:#cfd5df;font-size:13px;font-weight:700}
#tlOuro .bt:hover{background:#1b2029;color:#fff}
#tlOuro .bt.on{background:${COR};color:#0b0d11}
#tlOuro .tlo-lbl{position:static;font-size:10.5px;color:#6b7383;letter-spacing:.08em;font-weight:800;padding:0 4px}
#tlOuro input[type=range]{width:120px;accent-color:${COR};height:4px}
#tlOuro .zv{font:600 11px ui-monospace,Consolas,monospace;color:#8a93a3;min-width:58px;text-align:right}
#tlOuro .sp{flex:1}
#tlOuro .hint{font-size:11px;color:#596170}
#tlOuro .corpo{display:flex;position:relative}
#tlOuro .tlo-hd{flex:0 0 128px;background:#0f1218;border-right:1px solid #1f242e;z-index:6}
#tlOuro .tlo-hd .h{display:flex;align-items:center;gap:7px;padding:0 9px;border-bottom:1px solid #181c24;cursor:pointer;overflow:hidden}
#tlOuro .tlo-hd .h:hover{background:#141821}
#tlOuro .tlo-hd .sig{font:800 10px/1 Inter,sans-serif;color:#0b0d11;border-radius:4px;padding:3px 4px;min-width:22px;text-align:center}
#tlOuro .tlo-hd .nm{font:700 11.5px/1 Inter,sans-serif;color:#cfd5df}
#tlOuro .tlo-hd .ct{margin-left:auto;font:600 10px ui-monospace,monospace;color:#596170}
#tlOuro .tlo-hd .h.reg{cursor:default;background:#0b0d12;justify-content:center;font:600 10px ui-monospace,monospace;color:#596170}
#tlOuro .tlo-hd .h.min .nm:after{content:" ▸";color:#596170}
#tlOuro .sc{position:relative;flex:1 1 0;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;scrollbar-color:#2b313d #0c0e13}
#tlOuro .in{position:relative;--z:10}
#tlOuro .fx{position:relative;border-bottom:1px solid #181c24;overflow:hidden}
#tlOuro .fx.min>*:not(canvas){display:none}
#tlOuro .fx-regua{background:#0b0d12;cursor:col-resize;overflow:visible}
#tlOuro .mk{position:absolute;bottom:0;border-left:1px solid #2f3643;height:9px;pointer-events:none}
#tlOuro .mk.M{height:28px;border-color:#3a4250}
#tlOuro .mk.M span{position:absolute;left:4px;top:4px;font:600 10px ui-monospace,Consolas,monospace;color:#7d8796;white-space:nowrap}
#tlOuro .mk.f{height:5px;border-color:#20252f}
#tlOuro .fx-cenas,#tlOuro .fx-frases,#tlOuro .fx-palavras,#tlOuro .fx-efeitos{background:repeating-linear-gradient(90deg,transparent 0 calc(var(--z)*5px - 1px),rgba(255,255,255,.018) 0 calc(var(--z)*5px))}
#tlOuro .b{position:absolute;top:3px;bottom:3px;border-radius:6px;overflow:hidden;cursor:pointer;display:flex;align-items:center;white-space:nowrap;font-size:11.5px;line-height:1.1;padding:0 7px;border:1px solid rgba(255,255,255,.08);transition:filter .08s}
#tlOuro .b:hover{filter:brightness(1.3)}
#tlOuro .b.sel{outline:2px solid #fff;outline-offset:-1px;z-index:3;filter:brightness(1.35)}
#tlOuro .cn{color:#fff;background:linear-gradient(180deg,${COR}38,${COR}18);border-color:${COR}55;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
#tlOuro .cn.alt{background:linear-gradient(180deg,${COR}26,${COR}0f)}
#tlOuro .cn i{font-style:normal;font-weight:900;color:${COR};margin-right:6px;font-family:Montserrat,Inter,sans-serif}
#tlOuro .cn.on{background:linear-gradient(180deg,${COR}aa,${COR}66);border-color:${COR};color:#0b0d11;box-shadow:0 0 14px ${COR}66}
#tlOuro .cn.on i{color:#0b0d11}
#tlOuro .fr{background:linear-gradient(180deg,#3a2f6b,#2a2350);border-color:#5a49a8;color:#ddd5ff}
#tlOuro .fr b{color:#b9a8ff;margin-right:6px;font-weight:800}
#tlOuro .fr.on{border-color:#c9bbff;box-shadow:0 0 10px #8b6cff88}
#tlOuro .w{position:absolute;top:4px;bottom:4px;border-radius:3px;background:#2a303b;border:1px solid #3a4250;min-width:2px;cursor:pointer;overflow:hidden;font-size:0;color:#e9ecf1;padding:0 3px;display:flex;align-items:center;white-space:nowrap}
#tlOuro .zw .w{font-size:11px}
#tlOuro .w:hover{background:#4a5260}
#tlOuro .w.on{background:#e9ecf1;color:#0b0d11;border-color:#fff}
#tlOuro .w.sel{outline:2px solid #fff}
#tlOuro .s{position:absolute;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;transform:rotate(45deg);border-radius:2px;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 8px rgba(0,0,0,.6)}
#tlOuro .s:hover,#tlOuro .s.sel{transform:rotate(45deg) scale(1.5);z-index:3}
#tlOuro .s em{display:none;position:absolute;left:12px;top:-3px;transform:rotate(-45deg);transform-origin:0 0;font:600 10px Inter,sans-serif;font-style:normal;color:#cfd5df;white-space:nowrap;pointer-events:none}
#tlOuro .zs .s em{display:block}
#tlOuro .mo{position:absolute;top:4px;bottom:4px;width:6px;margin-left:-3px;border-radius:3px;background:var(--c);cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.55),0 0 8px color-mix(in srgb,var(--c) 50%,transparent)}
#tlOuro .mo:hover,#tlOuro .mo.sel{transform:scaleX(1.8);z-index:3;outline:1px solid #fff}
#tlOuro .mo em{display:none;position:absolute;left:9px;top:50%;transform:translateY(-50%);font:600 10px Inter,sans-serif;font-style:normal;color:#e2d6ff;white-space:nowrap;pointer-events:none}
#tlOuro .zs .mo em{display:block}
#tlOuro .fx-motion{background:#120f1a}
#tlOuro .fx-efeitos{background:#17110c}
#tlOuro .fx-audio{background:#0d1712}
#tlOuro canvas{position:absolute;top:0;left:0;pointer-events:none}
#tlOuro .ph{position:absolute;top:0;bottom:0;width:0;z-index:8;pointer-events:none}
#tlOuro .ph:after{content:"";position:absolute;top:0;bottom:0;left:-1px;width:2px;background:${COR};box-shadow:0 0 10px ${COR}}
#tlOuro .ph:before{content:"";position:absolute;top:0;left:-7px;width:14px;height:16px;background:${COR};clip-path:polygon(0 0,100% 0,100% 60%,50% 100%,0 60%);filter:drop-shadow(0 0 4px ${COR})}
#tlOuro .gh{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.35);z-index:7;pointer-events:none;display:none}
#tlOuro .gh span{position:absolute;top:2px;left:5px;font:600 10px ui-monospace,monospace;color:#0b0d11;background:#e9ecf1;border-radius:3px;padding:1px 4px;white-space:nowrap}
#tlOuro .mm{position:relative;height:24px;margin:0 0 0 128px;background:#090b0f;border-top:1px solid #1f242e;cursor:pointer}
#tlOuro .mm .mb{position:absolute;top:5px;bottom:5px;border-radius:2px;background:${COR}55}
#tlOuro .mm .mb.alt{background:${COR}30}
#tlOuro .mm .jan{position:absolute;top:1px;bottom:1px;border:2px solid #e9ecf1;border-radius:4px;background:rgba(255,255,255,.07);cursor:grab}
#tlOuro .mm .mph{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:${COR}}
#tlOuro .alca{height:12px;cursor:ns-resize;display:grid;place-items:center;background:#0f1218;border-top:1px solid #1f242e}
#tlOuro .alca:before{content:"";width:46px;height:4px;border-radius:3px;background:#2f3643}
#tlOuro .alca:hover:before{background:${COR}}
#tlOuro .det{display:flex;gap:12px;align-items:flex-start;padding:8px 12px;border-top:1px solid #1f242e;font-size:12px;min-height:36px;background:#0b0d12}
#tlOuro .det pre{flex:1;margin:0;font:11.5px/1.4 ui-monospace,Consolas,monospace;color:#d6dbe2;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:auto}
#tlOuro .det .vz{color:#596170}
#tlOuro .det .cp{all:unset;cursor:pointer;padding:6px 14px;border-radius:7px;background:${COR};color:#0b0d11;font-weight:800;font-size:12px;white-space:nowrap}
#tlOuro .pv{position:fixed;z-index:9998;left:-9999px;top:0;width:400px;pointer-events:none;visibility:hidden;opacity:0;background:#07090c;border:1px solid ${COR}88;border-radius:10px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.7),0 0 24px ${COR}33}
#tlOuro .pv.vis{visibility:visible;opacity:1}
#tlOuro .pv .tela{position:relative;width:400px;height:225px;background:#000 radial-gradient(circle at 50% 50%,#151922,#000)}
#tlOuro .pv .tela:before{content:"carregando prévia…";position:absolute;inset:0;display:grid;place-items:center;font-size:12px;color:#8a93a3}
#tlOuro .pv.erro .tela:before{content:"prévia indisponível (página pesada?) — tente de novo";color:#ff8a8a}
#tlOuro .pv iframe{position:absolute;inset:0;width:400px;height:225px;border:0;background:transparent;opacity:0;transition:opacity .12s}
#tlOuro .pv.pronta iframe{opacity:1}
#tlOuro .pv .pvl{display:flex;align-items:center;gap:8px;padding:6px 9px;font-size:12px;color:#e9ecf1;border-top:1px solid #1f242e}
#tlOuro .pv .pvl i{width:10px;height:10px;transform:rotate(45deg);border-radius:2px;flex:none}
#tlOuro .pv .pvl span{margin-left:auto;font:600 11px ui-monospace,monospace;color:#8a93a3}
#tlOuro .pv .bar{position:absolute;left:0;bottom:0;height:3px;background:${COR};width:0}
#tlOuro .tip{position:fixed;z-index:9999;pointer-events:none;background:#07090c;border:1px solid #2b313d;color:#e9ecf1;font-size:12px;padding:6px 9px;border-radius:7px;max-width:440px;display:none;box-shadow:0 10px 26px rgba(0,0,0,.55);line-height:1.35}
#tlOuro .tip b{color:${COR}}`;

  /* ---------------- dados ---------------- */
  const FRASES = (window.FRASES || []).filter(f => isFinite(f.inicio) && isFinite(f.fim));
  const PAL = window.PAL || G("PAL") || [];
  let MOTION = [], MAPA = {};
  const lerDados = () => { MOTION = (window.MOTION_EVENTOS || []).filter(e => isFinite(e.t)).sort((a, b) => a.t - b.t); MAPA = window.SFX_MAPA || {}; };
  // dados pesados (efeitos, motion, onda) num .js à parte (window.TL_DADOS = nome do arquivo, ver timeline_ouro.py); a mini-prévia nem baixa
  const carregarDados = () => new Promise(ok => {
    const src = window.TL_DADOS; if (!src || window.SFX_EVENTOS || window.ONDA || window.MOTION_EVENTOS) return ok();
    const sc = document.createElement("script"); sc.src = src; sc.async = true; sc.onload = sc.onerror = () => ok(); document.head.appendChild(sc);
  });
  const depoisDoQuadro = () => new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 0)));
  const somNome = (tipo) => MAPA[tipo] || tipo;   // 001/002: tipo da animação → arquivo de som; 003: já é o nome do som
  const MOCOR = { popIn: "#5ee08a", pilIn: "#cfd5df", soca: "#ff8a3d", treme: "#ff6b6b", carimbo: "#ff3b4e", fraseG: "#ffe29a", cardIn: "#9ad0ff",
    carroEntra: "#7fd6ff", capitulo: COR, versus: COR, barraLuz: COR, faiscas: "#ffd27a", sobe: "#ffe29a", lst: "#cfd5df", anel: "#b4f06c",
    scanner: "#7fd6ff", spam: "#ff6b6b", cometas: "#c78bff", pisca: "#ff9db0", enche: "#3fd0d0", desenha: "#9ad0ff", trava: "#ff3b4e",
    cai: "#ff9db0", zoomTo: "#b4f06c", sai: "#596170", clipe: "#3d6b8f", letras: "#ffe29a", medIn: "#3fd0d0", seta: "#9ad0ff", corte: "#7aa2ff", meme: "#ff5fd2" };
  const corMo = (t) => MOCOR[t] || "#c78bff";
  let SFX = [];
  const lerSfx = (j) => { const arr = Array.isArray(j) ? j : (j && j.eventos) || [];
    SFX = arr.map(e => Array.isArray(e) ? { t: +e[0], tipo: String(e[1]) } : { t: +e.t, tipo: String(e.tipo || "sfx") }).filter(e => isFinite(e.t)).sort((a, b) => a.t - b.t); };

  const CHAVE = "tlOuro:" + location.pathname;
  const S = { pxs: 10, vh: 1, min: {}, sel: null, selEl: null, arr: 0, ultimo: -1, fi: -2, wi: -2, pico: null, raf: 0 };
  try { Object.assign(S, JSON.parse(localStorage.getItem(CHAVE) || "{}"), { sel: null, selEl: null, arr: 0 }); } catch (e) {}
  const guarda = () => { try { localStorage.setItem(CHAVE, JSON.stringify({ pxs: S.pxs, vh: S.vh, min: S.min })); } catch (e) {} };
  let el = {};

  const tc = (t) => { t = Math.max(0, t); const f = Math.floor(t * FPS + 1e-6), h = Math.floor(f / (3600 * FPS)), m = Math.floor(f / (60 * FPS)) % 60, s = Math.floor(f / FPS) % 60, q = f % FPS;
    return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + ":" + String(q).padStart(2, "0"); };
  const mmss = (t) => { t = Math.max(0, t); return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0"); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const r2 = x => Math.round(x * 100) / 100;
  const pos = (t) => `left:calc(var(--z)*${t.toFixed(3)}px)`;
  const larg = (d, menos = 1) => `width:max(2px,calc(var(--z)*${Math.max(0, d).toFixed(3)}px - ${menos}px))`;
  const zmin = () => Math.max(.5, (el.sc ? el.sc.clientWidth - 24 : 900) / Math.max(1, total()));

  /* ---------------- estrutura ---------------- */
  function montar() {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    let box = document.getElementById("tlOuro");
    if (!box) { box = document.createElement("div"); box.id = "tlOuro";
      const ctrl = document.querySelector(".ctrl"); const vp = document.getElementById("viewport");
      (ctrl || vp).insertAdjacentElement("afterend", box); }
    if (REC) { box.style.display = "none"; return false; }
    box.innerHTML = `
      <div class="tb">
        <div class="tc"><span class="tcv">00:00:00</span><small class="tct"></small></div>
        <div class="grp"><button class="bt" data-a="prev" title="Cena anterior ( [ )">⏮</button><button class="bt" data-a="play" title="Tocar/pausar (espaço)">▶</button><button class="bt" data-a="next" title="Próxima cena ( ] )">⏭</button></div>
        <div class="grp"><span class="tlo-lbl">ZOOM</span><button class="bt" data-z="out" title="Diminuir zoom ( − )">−</button><input type="range" class="zr" min="0" max="1000" step="1"><button class="bt" data-z="in" title="Aumentar zoom ( + )">+</button><button class="bt" data-z="fit" title="Ajustar ao vídeo inteiro ( \\ )">Ajustar</button><span class="zv"></span></div>
        <div class="grp"><span class="tlo-lbl">ALTURA</span><button class="bt" data-v="out" title="Faixas mais baixas">▁</button><input type="range" class="vr" min="55" max="300" step="1"><button class="bt" data-v="in" title="Faixas mais altas">▇</button></div>
        <span class="sp"></span><span class="hint">Ctrl+roda zoom · Alt+roda altura · roda rola · clique/arraste pula · [ ] cenas</span>
      </div>
      <div class="corpo"><div class="tlo-hd"></div><div class="sc"><div class="in"></div></div></div>
      <div class="mm"><div class="jan"></div><div class="mph"></div></div>
      <div class="alca" title="Arraste para aumentar/diminuir a altura da timeline"></div>
      <div class="det"><span class="vz">Clique num bloco para ver o tempo exato, o ID e copiar o JSON.</span></div><div class="tip"></div>`;
    const q = s => box.querySelector(s);
    el = { box, sc: q(".sc"), in: q(".in"), hd: q(".tlo-hd"), det: q(".det"), tip: q(".tip"), tcv: q(".tcv"), tct: q(".tct"), zr: q(".zr"), vr: q(".vr"), zv: q(".zv"),
      mm: q(".mm"), jan: q(".jan"), mph: q(".mph"), alca: q(".alca"), play: q('[data-a="play"]'), fx: {}, h: {} };
    for (const [k, sig, nome, h, cor] of FAIXAS) {
      const hh = document.createElement("div"); hh.className = "h" + (k === "regua" ? " reg" : ""); hh.dataset.fx = k; hh.dataset.base = h;
      hh.innerHTML = k === "regua" ? "TIMECODE" : `<span class="sig" style="background:${cor}">${sig}</span><span class="nm">${nome}</span><span class="ct"></span>`;
      el.hd.appendChild(hh); el.h[k] = hh;
      const f = document.createElement("div"); f.className = "fx fx-" + k; f.dataset.fx = k; f.dataset.base = h; el.in.appendChild(f); el.fx[k] = f;
    }
    el.tlo_cv = document.createElement("canvas"); el.fx.audio.appendChild(el.tlo_cv);
    el.ph = document.createElement("div"); el.ph.className = "ph tlo-ph"; el.in.appendChild(el.ph);
    el.gh = document.createElement("div"); el.gh.className = "gh"; el.gh.innerHTML = "<span></span>"; el.in.appendChild(el.gh);
    // compatibilidade com o teste/versão 1
    el.sc.classList.add("tlo-sc"); el.in.classList.add("tlo-in"); el.det.classList.add("tlo-det");
    eventos(); return true;
  }

  /* ---------------- conteúdo (montado 1 vez; zoom só muda --z) ---------------- */
  function conteudo() {
    const T = total(), B = cena();
    let h = "";
    B.forEach((b, i) => { const ate = b.ate ?? (B[i + 1] ? B[i + 1].de : T);
      h += `<div class="b cn tlo-b tlo-cena${i % 2 ? " alt" : ""}" data-k="c${i}" style="${pos(b.de)};${larg(ate - b.de)}"><i>${String(i + 1).padStart(2, "0")}</i>${esc(b.nome || "")}</div>`; });
    el.fx.cenas.innerHTML = h; S.cenas = [...el.fx.cenas.children];
    h = ""; FRASES.forEach((f, i) => { h += `<div class="b fr tlo-b" data-k="f${i}" style="${pos(f.inicio)};${larg(f.fim - f.inicio)}"><b>${esc(f.id || "")}</b>${esc(f.texto || "")}</div>`; });
    el.fx.frases.innerHTML = h; S.frases = [...el.fx.frases.children];
    h = ""; PAL.forEach((w, i) => { h += `<div class="w" data-k="w${i}" style="${pos(w.s)};${larg((w.e ?? w.s + .2) - w.s, 1)}">${esc(w.t)}</div>`; });
    el.fx.palavras.innerHTML = h; S.pal = [...el.fx.palavras.children];
    h = ""; SFX.forEach((e, i) => { h += `<div class="s" data-k="s${i}" style="${pos(e.t)};background:${corSfx(e.tipo)}"><em>🔊 ${esc(somNome(e.tipo))}</em></div>`; });
    el.fx.efeitos.innerHTML = h;
    h = ""; MOTION.forEach((e, i) => { h += `<div class="mo" data-k="m${i}" style="${pos(e.t)};--c:${corMo(e.tipo)}"><em>${esc(e.tipo)}</em></div>`; });
    el.fx.motion.innerHTML = h;
    const cnt = { cenas: B.length, frases: FRASES.length, palavras: PAL.length, motion: MOTION.length, efeitos: SFX.length, audio: "" };
    for (const k in cnt) { const c = el.h[k] && el.h[k].querySelector(".ct"); if (c) c.textContent = cnt[k]; }
    // minimapa
    el.mm.querySelectorAll(".mb").forEach(x => x.remove());
    B.forEach((b, i) => { const ate = b.ate ?? (B[i + 1] ? B[i + 1].de : T); const d = document.createElement("div"); d.className = "mb" + (i % 2 ? " alt" : "");
      d.style.left = (b.de / T * 100) + "%"; d.style.width = `calc(${(ate - b.de) / T * 100}% - 1px)`; el.mm.insertBefore(d, el.jan); });
  }
  function item(k) {
    const n = +k.slice(1), B = cena();
    if (k[0] === "c") { const b = B[n]; return { tipo: "cena", n: n + 1, nome: b.nome, de: r2(b.de), ate: r2(b.ate ?? (B[n + 1] ? B[n + 1].de : total())) }; }
    if (k[0] === "f") { const f = FRASES[n]; return { tipo: "frase", id: f.id, texto: f.texto, inicio: r2(f.inicio), fim: r2(f.fim) }; }
    if (k[0] === "w") { const w = PAL[n]; return { tipo: "palavra", i: n, t: w.t, s: r2(w.s), e: r2(w.e) }; }
    if (k[0] === "m") { const e = MOTION[n]; return { tipo: "motion", i: n, efeito: e.tipo, t: r2(e.t), cena: e.c }; }
    const e = SFX[n]; return { tipo: "efeito sonoro", i: n, efeito: e.tipo, som: somNome(e.tipo), t: r2(e.t) };
  }

  /* ---------------- zoom / altura ---------------- */
  const z2r = p => Math.round(Math.log(p / zmin()) / Math.log(ZMAX / zmin()) * 1000);
  const r2z = r => zmin() * Math.pow(ZMAX / zmin(), r / 1000);
  function aplicaZoom(p, ancoraX) {
    const sc = el.sc, mx = ancoraX ?? sc.clientWidth / 2, tm = (sc.scrollLeft + mx) / S.pxs;
    S.pxs = Math.max(zmin(), Math.min(ZMAX, p));
    el.in.style.setProperty("--z", S.pxs); el.in.style.width = Math.ceil(total() * S.pxs + 60) + "px";
    sc.scrollLeft = tm * S.pxs - mx;
    el.in.classList.toggle("zw", S.pxs >= 70); el.in.classList.toggle("zs", S.pxs >= 140);
    el.zr.value = z2r(S.pxs); el.zv.textContent = S.pxs >= 100 ? Math.round(S.pxs) + " px/s" : S.pxs.toFixed(1) + " px/s";
    regua(); redesenha(); guarda();
  }
  function aplicaAltura(v) {
    S.vh = Math.max(.55, Math.min(3, v)); el.vr.value = Math.round(S.vh * 100);
    for (const [k] of FAIXAS) { const base = +el.fx[k].dataset.base, min = S.min[k] && k !== "regua";
      const hgt = k === "regua" ? base : min ? 14 : Math.round(base * S.vh);
      el.fx[k].style.height = el.h[k].style.height = hgt + "px"; el.fx[k].classList.toggle("min", !!min); el.h[k].classList.toggle("min", !!min); }
    redesenha(); guarda();
  }
  function regua() {
    const T = total(), sc = el.sc, x0 = sc.scrollLeft, x1 = x0 + sc.clientWidth;
    const passos = [1 / FPS, 2 / FPS, 5 / FPS, 10 / FPS, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const p = passos.find(x => x * S.pxs >= 80) || 600;
    const sub = p <= 1 / FPS * 10 ? 1 / FPS : p <= .5 ? 1 / FPS * 5 : p / 5;
    let h = ""; const ini = Math.max(0, Math.floor(x0 / S.pxs / sub) * sub), fim = Math.min(T, x1 / S.pxs + sub);
    for (let t = ini; t <= fim + 1e-6; t += sub) {
      const maior = Math.abs(t / p - Math.round(t / p)) < 1e-4;
      const quadro = !maior && sub < .1;
      h += `<div class="mk${maior ? " M" : quadro ? " f" : ""}" style="left:${(t * S.pxs).toFixed(1)}px">${maior ? `<span>${p < 1 ? tc(t) : p < 60 ? (t >= 60 ? mmss(t) : Math.round(t) + "s") : mmss(t)}</span>` : ""}</div>`;
    }
    el.fx.regua.innerHTML = h;
  }

  /* ---------------- onda (canvas do tamanho da tela, redesenhado no scroll) ---------------- */
  function onda() {
    const c = el.tlo_cv, sc = el.sc, w = sc.clientWidth, h = el.fx.audio.clientHeight, dpr = devicePixelRatio || 1;
    c.width = Math.max(1, w * dpr); c.height = Math.max(1, h * dpr); c.style.width = w + "px"; c.style.height = h + "px"; c.style.left = sc.scrollLeft + "px";
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const fimX = Math.min(w, total() * S.pxs - sc.scrollLeft);
    g.fillStyle = "#123321"; g.fillRect(0, 2, fimX, h - 4);                       // "clip" de áudio
    g.fillStyle = "#1f5c3a"; g.fillRect(0, h / 2 - .5, fimX, 1);
    if (S.min.audio || !S.pico) return;
    const { v, fps } = S.pico, meio = h / 2, amp = h / 2 - 5;
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, "#7dffb2"); grad.addColorStop(.5, "#2fbf71"); grad.addColorStop(1, "#7dffb2");
    g.fillStyle = grad; g.beginPath(); g.moveTo(0, meio);
    const ys = new Float32Array(Math.ceil(fimX) + 1);
    for (let x = 0; x <= fimX; x++) {
      const t0 = (sc.scrollLeft + x) / S.pxs, t1 = (sc.scrollLeft + x + 1) / S.pxs;
      let m = 0; const k0 = Math.floor(t0 * fps), k1 = Math.max(k0 + 1, Math.ceil(t1 * fps));
      if (k1 - k0 <= 2) { const f = t0 * fps - k0, a = v[k0] || 0, b = v[k0 + 1] || 0; m = a + (b - a) * f; }        // interpola quando o zoom é grande
      else for (let k = k0; k < k1 && k < v.length; k++) if (v[k] > m) m = v[k];
      ys[x] = Math.max(.6, Math.sqrt(m) * amp);
      g.lineTo(x, meio - ys[x]);
    }
    for (let x = Math.floor(fimX); x >= 0; x--) g.lineTo(x, meio + ys[x]);
    g.closePath(); g.fill();
    // frases da voz por cima (limites)
    g.fillStyle = "rgba(0,0,0,.35)";
    for (const f of FRASES) { const x = f.inicio * S.pxs - sc.scrollLeft; if (x > -2 && x < w) g.fillRect(x, 2, 1, h - 4); }
  }
  function minimapa() {
    const T = total(), sc = el.sc, W = T * S.pxs;
    el.jan.style.left = (sc.scrollLeft / W * 100) + "%"; el.jan.style.width = Math.min(100, sc.clientWidth / W * 100) + "%";
  }
  function redesenha() { cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(() => { regua(); onda(); minimapa(); }); }

  /* ---------------- relógio ---------------- */
  function atualizar() {
    const t = agora(); el.ph.style.left = t * S.pxs + "px"; el.mph.style.left = (t / total() * 100) + "%";
    el.tcv.textContent = tc(t); el.tct.textContent = "/ " + tc(total());
    el.play.textContent = tocando() ? "❚❚" : "▶";
    const B = cena(); let i = -1; for (let k = 0; k < B.length; k++) if (t >= B[k].de) i = k;
    if (i !== S.ultimo) { if (S.cenas[S.ultimo]) S.cenas[S.ultimo].classList.remove("on"); if (S.cenas[i]) S.cenas[i].classList.add("on"); S.ultimo = i; }
    const fi = FRASES.findIndex(f => t >= f.inicio && t < f.fim + .05);
    if (fi !== S.fi) { if (S.frases[S.fi]) S.frases[S.fi].classList.remove("on"); if (S.frases[fi]) S.frases[fi].classList.add("on"); S.fi = fi; }
    const wi = PAL.findIndex(w => t >= w.s - .02 && t < (w.e ?? w.s + .2) + .05);
    if (wi !== S.wi) { if (S.pal[S.wi]) S.pal[S.wi].classList.remove("on"); if (S.pal[wi]) S.pal[wi].classList.add("on"); S.wi = wi; }
    if (tocando() && !S.arr) { const x = t * S.pxs, sc = el.sc; if (x > sc.scrollLeft + sc.clientWidth * .9 || x < sc.scrollLeft) sc.scrollLeft = x - sc.clientWidth * .1; }
  }

  /* ---------------- interação ---------------- */
  const tAt = (ev) => (ev.clientX - el.in.getBoundingClientRect().left) / S.pxs;
  function mostrar(k, alvo) {
    if (S.selEl) S.selEl.classList.remove("sel"); S.sel = k; S.selEl = alvo || null; if (alvo) alvo.classList.add("sel");
    if (!k) { el.det.innerHTML = `<span class="vz">Clique num bloco para ver o tempo exato, o ID e copiar o JSON.</span>`; return; }
    const it = item(k), t0 = it.de ?? it.inicio ?? it.s ?? it.t, t1 = it.ate ?? it.fim ?? it.e;
    const id = it.tipo === "cena" ? `cena ${String(it.n).padStart(2, "0")} · ${it.nome}` : it.tipo === "frase" ? it.id : it.tipo === "palavra" ? `palavra #${it.i} “${it.t}”` : it.tipo === "motion" ? `motion #${it.i} · ${it.efeito} (cena ${it.cena})` : `som #${it.i} · ${it.som}`;
    const js = JSON.stringify(it, null, 1);
    el.det.innerHTML = `<div style="min-width:230px"><b style="color:${COR}">${esc(id)}</b><br>${Number(t0).toFixed(2)} s${t1 !== undefined ? " → " + Number(t1).toFixed(2) + " s  (" + (t1 - t0).toFixed(2) + " s)" : ""}<br><span style="color:#596170">${tc(t0)}</span></div><pre></pre><button class="cp">Copiar</button>`;
    el.det.querySelector("pre").textContent = js;
    const bt = el.det.querySelector(".cp"); bt.onclick = () => copiar(js).then(() => { bt.textContent = "Copiado ✔"; setTimeout(() => bt.textContent = "Copiar", 1400); });
  }
  function copiar(s) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(s).catch(() => velho(s));
    return Promise.resolve(velho(s));
    function velho(x) { const ta = document.createElement("textarea"); ta.value = x; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }
  }
  function dica(ev, txt) { if (!txt) { el.tip.style.display = "none"; return; } el.tip.innerHTML = txt; el.tip.style.display = "block";
    el.tip.style.left = Math.min(innerWidth - 450, ev.clientX + 14) + "px"; el.tip.style.top = (ev.clientY + 18) + "px"; }
  function txtDica(k) { const it = item(k);
    if (it.tipo === "cena") return `<b>${String(it.n).padStart(2, "0")} · ${esc(it.nome)}</b><br>${it.de.toFixed(2)} → ${it.ate.toFixed(2)} s`;
    if (it.tipo === "frase") return `<b>${esc(it.id)}</b> · ${esc(it.texto)}<br>${it.inicio.toFixed(2)} → ${it.fim.toFixed(2)} s`;
    if (it.tipo === "palavra") return `<b>${esc(it.t)}</b> · ${it.s.toFixed(2)} → ${it.e.toFixed(2)} s`;
    if (it.tipo === "motion") return `<b>${esc(it.efeito)}</b> · motion · ${it.t.toFixed(2)} s`;
    return `<b>🔊 ${esc(it.som)}</b> · ${it.t.toFixed(2)} s`; }

  /* ---------------- janelinha de prévia (motion e som): a própria página em modo mini, em loop no trecho ---------------- */
  /* A janelinha nunca usa display:none (o iframe ficaria 0×0 e o palco seria escalado a 0 → tela preta); fica invisível.
     O iframe só aparece quando a mini-página avisa por postMessage que desenhou um quadro do trecho ("pronto").
     Watchdog: se não ficar pronta, reenvia o pedido e depois recarrega o iframe (até 3 vezes). */
  let pvTimer = 0, pvK = null, pvHash = "", pvVivo = false, pvPronto = false, pvWd = 0, pvTent = 0, pvN = 0, pvBase = "", pvDur = 1, pvCarregou = false, pvEspera = 0;
  const pvRaiz = () => location.href.split("#")[0].split("?")[0] + "?tlprev=1";
  function pvBarra() { el.pvb.style.transition = "none"; el.pvb.style.width = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => { el.pvb.style.transition = `width ${pvDur}s linear`; el.pvb.style.width = "100%"; })); }
  function pvMensagem(ev) {
    const d = ev.data; if (!d || typeof d !== "object" || d.tlprev === undefined || !el.pvf || ev.source !== el.pvf.contentWindow) return;
    if (d.tlprev === "vivo") pvVivo = true;
    else if (d.tlprev === "pronto" && d.h === pvHash) { pvVivo = true; pvPronto = true; clearTimeout(pvWd); el.pv.classList.add("pronta"); el.pv.classList.remove("erro"); pvBarra(); }
  }
  function pvCarrega(recarregar) {
    pvPronto = false; pvEspera = 0; el.pv.classList.remove("pronta", "erro");
    try {
      if (!el.pvf.getAttribute("src") || recarregar) { pvVivo = false; pvCarregou = false; pvBase = pvRaiz() + (recarregar ? "&r=" + (++pvN) : ""); el.pvf.src = pvBase + "#" + pvHash; }
      else el.pvf.contentWindow.location.replace(pvBase + "#" + pvHash);
    } catch (e) { pvVivo = false; pvCarregou = false; pvBase =pvRaiz() + "&r=" + (++pvN); el.pvf.src = pvBase + "#" + pvHash; }
    clearTimeout(pvWd);
    pvWd = setTimeout(function cao() {
      if (pvPronto || !pvK) return;
      pvEspera += 1250;
      // ainda baixando (sem "vivo" e sem load): espera até ~7,5 s antes de recarregar — recarregar só recomeçaria o download
      if (!pvVivo && !pvCarregou && pvEspera < 7500) { pvWd = setTimeout(cao, 1250); return; }
      if (pvVivo && pvEspera === 1250) {                       // viva mas sem quadro: pede o trecho de novo (barato)
        pvHash = pvHash.replace(/&n=\d+$/, "") + "&n=" + (++pvN);
        try { el.pvf.contentWindow.location.replace(pvBase + "#" + pvHash); } catch (e) {}
        pvWd = setTimeout(cao, 1250); return; }
      if (pvEspera < 2500) { pvWd = setTimeout(cao, 1250); return; }
      if (++pvTent > 3) { el.pv.classList.add("erro"); return; }
      pvCarrega(true);                                          // ~2,5 s sem ficar pronta: recarrega o iframe
    }, 1250);
  }
  function previa(k, ev) {
    if (!k) { clearTimeout(pvTimer); clearTimeout(pvWd); pvK = null;
      if (el.pv) { el.pv.classList.remove("vis", "pronta"); pvPronto = false; try { if (el.pvf.getAttribute("src") && pvVivo) el.pvf.contentWindow.location.replace(pvBase + "#pausa"); } catch (e) {} } return; }
    if (!el.pv) {
      el.pv = document.createElement("div"); el.pv.className = "pv";
      el.pv.innerHTML = `<div class="tela"><iframe title="prévia do efeito"></iframe><div class="bar"></div></div><div class="pvl"><i></i><b></b><span></span></div>`;
      el.box.appendChild(el.pv); el.pvf = el.pv.querySelector("iframe"); el.pvb = el.pv.querySelector(".bar");
      addEventListener("message", pvMensagem); el.pvf.addEventListener("load", () => { pvCarregou = true; });
    }
    // posição ao lado do mouse; vira para a esquerda/baixo se não couber e nunca sai da tela (o vídeo agora fica fixo no topo)
    const W = 402, H = 262, m = 8, vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
    let x = ev.clientX + 18, y = ev.clientY - H - 14;
    if (x + W > vw - m) x = ev.clientX - W - 18;
    if (y < m) y = ev.clientY + 22;
    x = Math.max(m, Math.min(vw - W - m, x)); y = Math.max(m, Math.min(vh - H - m, y));
    el.pv.style.left = x + "px"; el.pv.style.top = y + "px";
    if (k === pvK) return; pvK = k; clearTimeout(pvTimer); clearTimeout(pvWd); pvPronto = false; el.pv.classList.remove("pronta");
    pvTimer = setTimeout(() => {
      if (pvK !== k) return;
      const it = item(k), t = it.t, a = Math.max(0, t - PV_ANTES), b = Math.min(total(), t + PV_DEPOIS);
      const cor = k[0] === "m" ? corMo(it.efeito) : corSfx(it.efeito);
      el.pv.querySelector(".pvl i").style.background = cor;
      el.pv.querySelector(".pvl b").textContent = k[0] === "m" ? `${it.efeito}  · motion` : `🔊 ${it.som}`;
      el.pv.querySelector(".pvl span").textContent = tc(t);
      pvHash = `t=${t.toFixed(3)}&a=${a.toFixed(3)}&b=${b.toFixed(3)}&n=${++pvN}`; pvDur = Math.max(.1, b - a); pvTent = 0;
      el.pv.classList.add("vis"); el.pvb.style.transition = "none"; el.pvb.style.width = "0";
      pvCarrega(false);
    }, 140);
  }

  /* ---------------- modo mini (dentro da janelinha): só o palco, mudo, em loop no trecho ---------------- */
  function modoMini() {
    const st = document.createElement("style");
    st.textContent = `html,body{background:#000!important;overflow:hidden!important;margin:0!important}
header,aside,#lista,.ctrl,.info,#tlOuro,#capa,#leg,#marca{display:none!important}
main{display:block!important;padding:0!important;margin:0!important}
section{margin:0!important}
#viewport{position:fixed!important;left:0;top:0;width:100vw!important;border:0!important;border-radius:0!important;box-shadow:none!important}`;
    document.head.appendChild(st);
    const avisa = (m) => { try { if (parent !== window) parent.postMessage(Object.assign({ tlprev: "" }, m), "*"); } catch (e) {} };
    const forca = (code) => { try { eval(code); } catch (e) {} };            // escreve em let globais do player (ex.: curB=-1)
    // a prévia é muda: solta a voz/música/efeitos (não baixa ~70 MB de áudio de novo; o relógio do player anda sozinho sem áudio)
    for (const n of ["audio", "musica", "sfx"]) { const a = G(n); if (a) { try { a.muted = true; a.volume = 0; a.pause(); a.removeAttribute("src"); a.load(); } catch (e) {} } }
    const mudo = () => { for (const n of ["audio", "musica", "sfx"]) { const a = G(n); if (a) { a.muted = true; a.volume = 0; } } };
    const vp = document.getElementById("viewport");
    const enquadra = () => { const f = G("fit"); if (typeof f === "function") try { f(); } catch (e) {} };
    let A = 0, Bf = 1, pedido = "", esperando = 0;
    const desenhou = () => { const s = document.getElementById("stage"); return vp && vp.clientWidth > 0 && vp.offsetHeight > 0 && G("curB") >= 0 && (!s || !/scale\(0\)/.test(s.style.transform)); };
    const espera = (h, n) => {                                              // 2 quadros depois do pulo com a cena montada → "pronto"
      if (h !== pedido) return;
      if (n >= 2 && desenhou()) { avisa({ tlprev: "pronto", h }); return; }
      if (vp && vp.clientWidth === 0) enquadra();
      if (n > 600) return; requestAnimationFrame(() => espera(h, n + 1));
    };
    const ler = () => {
      const h = location.hash.slice(1);
      if (h === "pausa") { pedido = ""; const f = G("pausa"); if (typeof f === "function" && tocando()) f(); return; }
      const p = new URLSearchParams(h); if (!p.has("t")) return;
      A = +p.get("a"); Bf = +p.get("b"); pedido = h; mudo(); enquadra();
      pular(A); forca("curB=-1");                                           // força a montagem da cena no próximo quadro
      if (!tocando()) { const f = G("toca"); if (typeof f === "function") try { f(); } catch (e) {} }
      mudo(); requestAnimationFrame(() => espera(h, 0));
    };
    enquadra(); addEventListener("resize", enquadra);
    addEventListener("hashchange", ler);
    const loop = () => { if (tocando() && agora() >= Bf) { pular(A); forca("curB=-1"); } requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    avisa({ tlprev: "vivo" });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(enquadra);
    requestAnimationFrame(ler);
  }
  const irCena = (d) => { const B = cena(), t = agora(); let i = -1; for (let k = 0; k < B.length; k++) if (t >= B[k].de - .02) i = k;
    const alvo = d < 0 ? (t - (B[i] ? B[i].de : 0) > .4 ? i : i - 1) : i + 1; if (B[alvo]) { pular(B[alvo].de + .01); centra(B[alvo].de); } };
  const centra = (t) => { const sc = el.sc, x = t * S.pxs; if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = x - sc.clientWidth * .3; };

  function eventos() {
    const sc = el.sc;
    sc.addEventListener("pointerdown", ev => {
      if (ev.button !== 0) return; S.arr = 1; sc.setPointerCapture(ev.pointerId);
      const alvo = ev.target.closest("[data-k]"); if (alvo) mostrar(alvo.dataset.k, alvo);
      pular(tAt(ev)); dica(ev, null); previa(null);
    });
    sc.addEventListener("pointermove", ev => {
      const t = Math.max(0, Math.min(total(), tAt(ev)));
      el.gh.style.display = "block"; el.gh.style.left = t * S.pxs + "px"; el.gh.firstChild.textContent = tc(t);
      if (S.arr) { pular(t); const r = sc.getBoundingClientRect(); if (ev.clientX > r.right - 30) sc.scrollLeft += 18; if (ev.clientX < r.left + 30) sc.scrollLeft -= 18; return; }
      const a = ev.target.closest("[data-k]");
      if (a && (a.dataset.k[0] === "s" || a.dataset.k[0] === "m")) { dica(ev, null); previa(a.dataset.k, ev); }
      else { previa(null); dica(ev, a && txtDica(a.dataset.k)); }
    });
    const solta = () => { S.arr = 0; }; sc.addEventListener("pointerup", solta); sc.addEventListener("pointercancel", solta);
    sc.addEventListener("pointerleave", () => { el.gh.style.display = "none"; dica(null, null); previa(null); });
    const roda = ev => {
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) { const r = sc.getBoundingClientRect(); aplicaZoom(S.pxs * Math.pow(1.0018, -ev.deltaY), Math.max(0, ev.clientX - r.left)); }
      else if (ev.altKey) aplicaAltura(S.vh * Math.pow(1.0015, -ev.deltaY));
      else sc.scrollLeft += (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY);
    };
    sc.addEventListener("wheel", roda, { passive: false }); el.hd.addEventListener("wheel", roda, { passive: false });
    sc.addEventListener("scroll", () => redesenha());
    el.zr.addEventListener("input", () => aplicaZoom(r2z(+el.zr.value)));
    el.vr.addEventListener("input", () => aplicaAltura(+el.vr.value / 100));
    el.box.querySelector(".tb").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return;
      const z = b.dataset.z, v = b.dataset.v, a = b.dataset.a;
      if (z === "fit") ajustar(); if (z === "in") aplicaZoom(S.pxs * 1.6); if (z === "out") aplicaZoom(S.pxs / 1.6);
      if (v === "in") aplicaAltura(S.vh * 1.2); if (v === "out") aplicaAltura(S.vh / 1.2);
      if (a === "play") playPause(); if (a === "prev") irCena(-1); if (a === "next") irCena(1); });
    el.hd.addEventListener("click", ev => { const h = ev.target.closest(".h"); if (!h || h.dataset.fx === "regua") return; S.min[h.dataset.fx] = !S.min[h.dataset.fx]; aplicaAltura(S.vh); });
    // minimapa: clique centraliza, arrastar a janela rola
    let mmArr = null;
    el.mm.addEventListener("pointerdown", ev => { const r = el.mm.getBoundingClientRect(), W = total() * S.pxs;
      const naJan = ev.target === el.jan; mmArr = { x: ev.clientX, s: sc.scrollLeft, naJan }; el.mm.setPointerCapture(ev.pointerId);
      if (!naJan) sc.scrollLeft = (ev.clientX - r.left) / r.width * W - sc.clientWidth / 2; });
    el.mm.addEventListener("pointermove", ev => { if (!mmArr) return; const r = el.mm.getBoundingClientRect(), W = total() * S.pxs;
      sc.scrollLeft = mmArr.naJan ? mmArr.s + (ev.clientX - mmArr.x) / r.width * W : (ev.clientX - r.left) / r.width * W - sc.clientWidth / 2; });
    el.mm.addEventListener("pointerup", () => mmArr = null);
    // alça: arrastar muda a altura das faixas
    let al = null;
    el.alca.addEventListener("pointerdown", ev => { al = { y: ev.clientY, v: S.vh, h: el.in.offsetHeight }; el.alca.setPointerCapture(ev.pointerId); });
    el.alca.addEventListener("pointermove", ev => { if (al) aplicaAltura(al.v * (al.h + ev.clientY - al.y) / al.h); });
    el.alca.addEventListener("pointerup", () => al = null);
    el.alca.addEventListener("dblclick", () => aplicaAltura(1));
    // teclado (não briga com o player: ele usa espaço, ←, →, r)
    addEventListener("keydown", ev => {
      if (/input|textarea|select/i.test((ev.target && ev.target.tagName) || "")) return;
      if (ev.key === "+" || ev.key === "=") { aplicaZoom(S.pxs * 1.5); ev.preventDefault(); }
      else if (ev.key === "-" || ev.key === "_") { aplicaZoom(S.pxs / 1.5); ev.preventDefault(); }
      else if (ev.key === "\\" || (ev.shiftKey && (ev.key === "Z" || ev.key === "z"))) { ajustar(); ev.preventDefault(); }
      else if (ev.key === "[") irCena(-1); else if (ev.key === "]") irCena(1);
      else if (ev.key === "Home") { pular(0); el.sc.scrollLeft = 0; } else if (ev.key === "End") { pular(total() - .05); centra(total()); }
      else if (ev.key === "Enter" && S.sel) { const it = item(S.sel); pular((it.de ?? it.inicio ?? it.s ?? it.t) + .01); }
    });
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (S.pxs < zmin()) aplicaZoom(zmin()); else redesenha(); }, 120); });
  }
  const ajustar = () => { aplicaZoom(zmin()); el.sc.scrollLeft = 0; redesenha(); };

  /* ---------------- áudio: picos ---------------- */
  async function carregarOnda() {
    if (window.ONDA && window.ONDA.v) { const o = window.ONDA; S.pico = { fps: o.fps, v: o.v.map(x => x / (o.max || 99)) }; redesenha(); return; }
    try {
      const a = G("audio"); const src = a && a.src; if (!src) return;
      const buf = await (await fetch(src)).arrayBuffer();
      const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 2, 44100);
      const ab = await ac.decodeAudioData(buf); const d = ab.getChannelData(0), fps = 100, h = Math.floor(ab.sampleRate / fps), v = new Float32Array(Math.ceil(d.length / h));
      let mx = 1e-6; for (let i = 0; i < v.length; i++) { let m = 0; for (let k = i * h, e = Math.min(d.length, k + h); k < e; k++) { const x = Math.abs(d[k]); if (x > m) m = x; } v[i] = m; if (m > mx) mx = m; }
      S.pico = { fps, v: Array.from(v, x => x / mx) }; redesenha();
    } catch (e) { /* file:// ou sem áudio → faixa lisa */ }
  }
  async function carregarSfx() {
    if (window.SFX_EVENTOS) { lerSfx(window.SFX_EVENTOS); return; }
    try { const r = await fetch("sfx.json"); if (r.ok) lerSfx(await r.json()); } catch (e) {}
  }

  async function iniciar() {
    if (MINI) { modoMini(); return; }
    if (!montar()) return;
    aplicaAltura(S.vh || 1);                                     // o esqueleto já ocupa a altura certa (o player fixo se dimensiona por ela)
    await Promise.all([carregarDados(), depoisDoQuadro()]);      // monta os ~4.600 blocos só depois do 1º quadro do vídeo
    lerDados(); await carregarSfx();
    conteudo();
    const salvo = S.pxs; aplicaZoom(zmin()); if (salvo > zmin() * 1.01) aplicaZoom(salvo); else el.sc.scrollLeft = 0;
    carregarOnda();
    const loop = () => { atualizar(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    window.TIMELINE_OURO = { pronta: true, cenas: () => S.cenas.length, frases: () => S.frases.length, palavras: () => S.pal.length, efeitos: () => SFX.length, motion: () => MOTION.length, onda: () => !!S.pico,
      zoom: (f) => aplicaZoom(S.pxs * f), pxs: () => S.pxs, altura: (v) => aplicaAltura(v), ajustar };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
