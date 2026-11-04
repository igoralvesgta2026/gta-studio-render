/* =====================================================================
   GTA-Studio · PLAYER OURO — player moderno embaixo do palco dos vídeos em HTML
   ---------------------------------------------------------------------
   Incluído por motor/timeline_ouro.py (inclui_timeline), depois do <script> do player.
   - Deixa o vídeo FIXO no topo (sticky) enquanto a timeline rola embaixo; janela 16:9 limitada em altura.
   - Troca o "Tocar com a voz" (#capa) e a linha de botões (.ctrl) por uma barra de player:
     play/pausa · barra de progresso arrastável (marcas das cenas + prévia do tempo) · tempo · volume geral ·
     Música / Efeitos / Legenda · velocidade 1× 0,5× 0,25× · Renderizar (só se existir window.RenderOuro) · tela cheia.
   - Atalhos: espaço = tocar/pausar · ← → = 5 s · F = tela cheia · M = mudo. Clique no vídeo = tocar/pausar.
   - Só LÊ o player (clock, playing, TOTAL, BEATS, rate, audio, musica, sfx) e chama toca()/pausa()/vaiPara()/fit();
     Música/Efeitos/Legenda/velocidade clicam nos botões originais escondidos (o estado continua sendo do player).
   - ?rec=1 (gravação) e ?tlprev=1 (mini-prévia da timeline): não faz nada.
   ===================================================================== */
(function () {
  "use strict";
  if (/[?&](rec|tlprev)=1\b/.test(location.search)) return;
  const G = (n) => { try { return eval(n); } catch (e) { return undefined; } };
  const vp = document.getElementById("viewport");
  if (!vp || typeof G("toca") !== "function" || typeof G("vaiPara") !== "function") return;

  const total = () => +G("TOTAL") || 60;
  const agora = () => +G("clock") || 0;
  const tocando = () => !!G("playing");
  const cenas = () => G("BEATS") || [];
  const chama = (n, ...a) => { const f = G(n); if (typeof f === "function") return f(...a); };
  const pular = (t) => chama("vaiPara", Math.max(0, Math.min(total() - 0.01, t)));
  const playPause = () => chama(tocando() ? "pausa" : "toca");
  const mmss = (t) => { t = Math.max(0, t || 0); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t % 60);
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const COR = (getComputedStyle(document.documentElement).getPropertyValue("--ouro") || "").trim() || "#F6B13D";
  const CHAVE = "playerOuro:vol";

  /* ---------------- ícones (SVG em linha) ---------------- */
  const I = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path class="o1" d="M15.5 9a4.2 4.2 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="o2" d="M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    mudo: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    cheia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    sair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    render: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor"/></svg>',
  };

  /* ---------------- CSS ---------------- */
  const css = `
#poFixo{--poH:clamp(300px,min(60vh,calc(100vh - 450px)),720px);position:sticky;top:0;z-index:40;background:var(--ui-bg,#07080b);padding:8px 0 10px;margin:-8px 0 0}
#poFixo:after{content:"";position:absolute;left:0;right:0;bottom:-14px;height:14px;pointer-events:none;background:linear-gradient(var(--ui-bg,#07080b),transparent)}
#poFixo .po-col{width:min(100%,calc(var(--poH) * 16 / 9));margin:0 auto}
#poFixo #viewport{width:100%!important;border:0!important;border-radius:12px 12px 0 0;box-shadow:0 0 0 1px rgba(255,255,255,.07),0 14px 34px rgba(0,0,0,.5);cursor:pointer}
@media (min-width:901px){main>aside#lista{position:sticky;top:0;align-self:start;max-height:100vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#2b313d transparent;padding-bottom:12px}}
#capa{display:none!important}
.ctrl{display:none!important}
#poFixo .po-bar{position:relative;background:linear-gradient(#11141b,#0c0e13);box-shadow:0 0 0 1px rgba(255,255,255,.07),0 14px 34px rgba(0,0,0,.45);border-radius:0 0 12px 12px;padding:0 10px 6px;font-family:Inter,system-ui,sans-serif;color:#d6dbe2;user-select:none}
#poFixo .po-prog{position:relative;height:18px;cursor:pointer;touch-action:none;margin:0 2px}
#poFixo .po-trilho{position:absolute;left:0;right:0;top:7px;height:4px;border-radius:3px;background:rgba(255,255,255,.12);transition:top .12s,height .12s;overflow:hidden}
#poFixo .po-prog:hover .po-trilho,#poFixo .po-prog.arr .po-trilho{top:6px;height:6px}
#poFixo .po-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:${COR};border-radius:3px;box-shadow:0 0 10px ${COR}88}
#poFixo .po-hov{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.18);display:none}
#poFixo .po-prog:hover .po-hov{display:block}
#poFixo .po-mk{position:absolute;top:0;bottom:0;width:1px;background:rgba(7,8,11,.55);pointer-events:none}
#poFixo .po-knob{position:absolute;top:9px;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px ${COR}66,0 2px 6px rgba(0,0,0,.6);transform:scale(0);transition:transform .12s;pointer-events:none}
#poFixo .po-prog:hover .po-knob,#poFixo .po-prog.arr .po-knob{transform:scale(1)}
#poFixo .po-tip{position:absolute;bottom:22px;transform:translateX(-50%);background:#07090c;border:1px solid #2b313d;border-radius:7px;padding:5px 8px;font-size:11.5px;white-space:nowrap;pointer-events:none;display:none;box-shadow:0 8px 20px rgba(0,0,0,.55);text-align:center;z-index:2}
#poFixo .po-tip b{display:block;font:700 13px/1.2 "JetBrains Mono",ui-monospace,Consolas,monospace;color:${COR}}
#poFixo .po-tip span{color:#aab2bf;max-width:260px;overflow:hidden;text-overflow:ellipsis;display:block}
#poFixo .po-prog:hover .po-tip,#poFixo .po-prog.arr .po-tip{display:block}
#poFixo .po-lin{display:flex;align-items:center;gap:4px;min-height:36px}
#poFixo .po-bt{all:unset;box-sizing:border-box;cursor:pointer;height:32px;min-width:32px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;color:#d6dbe2;font-size:12.5px;font-weight:600;white-space:nowrap;transition:background .1s,color .1s}
#poFixo .po-bt:hover{background:rgba(255,255,255,.08);color:#fff}
#poFixo .po-bt:focus-visible{outline:2px solid ${COR};outline-offset:1px}
#poFixo .po-bt svg{width:20px;height:20px;fill:currentColor;flex:none}
#poFixo svg[fill=none]{fill:none}
#poFixo .po-play{width:38px;height:38px;border-radius:50%;background:${COR};color:#07080b;padding:0;margin-right:4px}
#poFixo .po-play:hover{background:${COR};color:#07080b;filter:brightness(1.12)}
#poFixo .po-play svg{width:20px;height:20px}
#poFixo .po-tempo{font:600 12.5px ui-monospace,"JetBrains Mono",Consolas,monospace;color:#aab2bf;padding:0 8px;white-space:nowrap}
#poFixo .po-tempo b{color:#fff;font-weight:700}
#poFixo .po-vol{display:flex;align-items:center}
#poFixo .po-vol input{width:0;opacity:0;transition:width .15s,opacity .15s;accent-color:${COR};height:4px;margin:0;cursor:pointer}
#poFixo .po-vol:hover input,#poFixo .po-vol:focus-within input,#poFixo.po-sempre .po-vol input{width:78px;opacity:1;margin:0 6px 0 2px}
#poFixo .po-vol.mudo .o1,#poFixo .po-vol.baixo .o2{display:none}
#poFixo .po-sp{flex:1}
#poFixo .po-tg{color:#7d8796;font-size:12px}
#poFixo .po-tg i{width:6px;height:6px;border-radius:50%;background:#3a4250;flex:none}
#poFixo .po-tg.on{color:#e9ecf1}
#poFixo .po-tg.on i{background:${COR};box-shadow:0 0 6px ${COR}}
#poFixo .po-sep{width:1px;height:20px;background:rgba(255,255,255,.1);margin:0 4px}
#poFixo .po-vel{display:flex;gap:2px;padding:2px;border-radius:9px;background:rgba(255,255,255,.05)}
#poFixo .po-vel .po-bt{height:28px;min-width:0;padding:0 8px;font-size:12px;border-radius:7px;color:#9aa3b0}
#poFixo .po-vel .po-bt.on{background:${COR};color:#07080b}
#poFixo .po-rend{display:none;background:${COR}22;color:${COR};border:1px solid ${COR}66}
#poFixo .po-rend.vis{display:inline-flex}
#poFixo .po-rend:hover{background:${COR};color:#07080b}
#poFixo .po-flash{position:absolute;left:50%;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:rgba(7,8,11,.55);display:grid;place-items:center;color:#fff;opacity:0;pointer-events:none;z-index:90}
#poFixo .po-flash svg{width:40px;height:40px;fill:currentColor}
#poFixo .po-flash.vai{animation:poFlash .55s ease-out}
@keyframes poFlash{0%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.35)}}
#poFixo .po-grande{position:absolute;left:50%;top:50%;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;background:${COR};color:#07080b;display:grid;place-items:center;z-index:89;pointer-events:none;box-shadow:0 0 0 10px ${COR}33,0 0 50px ${COR}88;transition:opacity .2s,transform .2s}
#poFixo .po-grande svg{width:44px;height:44px;fill:currentColor;margin-left:5px}
#poFixo.tocando .po-grande,#poFixo.ja .po-grande{opacity:0;transform:scale(.85)}
#poFixo:fullscreen{padding:0;margin:0;background:#000;display:flex;flex-direction:column}
#poFixo:fullscreen:after{display:none}
#poFixo:fullscreen .po-col{width:100%;height:100%;display:flex;flex-direction:column}
#poFixo:fullscreen #viewport{flex:1 1 auto;height:auto!important;min-height:0;border:0;border-radius:0;box-shadow:none}
#poFixo:fullscreen .po-bar{border-radius:0;border:0;border-top:1px solid rgba(255,255,255,.07)}
#poFixo .po-bar{container-type:inline-size}
#poFixo .po-lin>*{flex-shrink:0}
@container (max-width:800px){#poFixo .po-rend span{display:none}#poFixo .po-rend{padding:0 6px}#poFixo .po-tg{padding:0 5px;gap:4px}#poFixo .po-vel .po-bt{padding:0 6px}#poFixo .po-tempo{padding:0 4px;font-size:12px}#poFixo .po-sep{margin:0 2px}}
@container (max-width:520px){#poFixo .po-vel,#poFixo .po-vel+.po-sep,#poFixo .po-tt{display:none}}
@container (max-width:400px){#poFixo .po-tg span{display:none}}`;

  /* ---------------- estrutura ---------------- */
  const st = document.createElement("style"); st.id = "playerOuroCss"; st.textContent = css; document.head.appendChild(st);
  const fixo = document.createElement("div"); fixo.id = "poFixo";
  const col = document.createElement("div"); col.className = "po-col"; fixo.appendChild(col);
  vp.parentNode.insertBefore(fixo, vp); col.appendChild(vp);
  const flash = document.createElement("div"); flash.className = "po-flash"; vp.appendChild(flash);
  const grande = document.createElement("div"); grande.className = "po-grande"; grande.innerHTML = I.play; vp.appendChild(grande);
  const orig = (sel) => document.querySelector(sel);
  const temOrig = { mus: !!orig("#bMus"), sfx: !!orig("#bSfx"), leg: !!orig("#bLeg"), vel: !!orig("[data-sp]") };
  const bar = document.createElement("div"); bar.className = "po-bar";
  bar.innerHTML = `
    <div class="po-prog" title=""><div class="po-trilho"><div class="po-hov"></div><div class="po-fill"></div></div><div class="po-knob"></div><div class="po-tip"><b></b><span></span></div></div>
    <div class="po-lin">
      <button class="po-bt po-play" title="Tocar/pausar (espaço)" aria-label="Tocar">${I.play}</button>
      <div class="po-vol"><button class="po-bt po-mute" title="Mudo (M)" aria-label="Mudo">${I.vol}</button><input type="range" min="0" max="100" step="1" aria-label="Volume geral" title="Volume geral"></div>
      <span class="po-tempo"><b class="po-atual">0:00</b><span class="po-tt"> / <span class="po-total">0:00</span></span></span>
      <span class="po-sp"></span>
      ${temOrig.mus ? '<button class="po-bt po-tg" data-o="#bMus" title="Música liga/desliga"><i></i><span>Música</span></button>' : ""}
      ${temOrig.sfx ? '<button class="po-bt po-tg" data-o="#bSfx" title="Efeitos sonoros liga/desliga"><i></i><span>Efeitos</span></button>' : ""}
      ${temOrig.leg ? '<button class="po-bt po-tg" data-o="#bLeg" title="Legenda liga/desliga"><i></i><span>Legenda</span></button>' : ""}
      ${temOrig.vel ? '<span class="po-sep"></span><div class="po-vel" title="Velocidade"><button class="po-bt" data-v="1">1×</button><button class="po-bt" data-v="0.5">0,5×</button><button class="po-bt" data-v="0.25">0,25×</button></div>' : ""}
      <span class="po-sep"></span>
      <button class="po-bt po-rend" title="Renderizar o vídeo"><span>Renderizar</span>${I.render}</button>
      <button class="po-bt po-fs" title="Tela cheia (F)" aria-label="Tela cheia">${I.cheia}</button>
    </div>`;
  col.appendChild(bar);
  const q = s => bar.querySelector(s);
  const el = { prog: q(".po-prog"), fill: q(".po-fill"), hov: q(".po-hov"), knob: q(".po-knob"), tip: q(".po-tip"), tipT: q(".po-tip b"), tipC: q(".po-tip span"),
    trilho: q(".po-trilho"), play: q(".po-play"), mute: q(".po-mute"), vol: q(".po-vol input"), volBox: q(".po-vol"), atual: q(".po-atual"), tot: q(".po-total"),
    rend: q(".po-rend"), fs: q(".po-fs"), tgs: [...bar.querySelectorAll(".po-tg")], vels: [...bar.querySelectorAll(".po-vel .po-bt")] };

  /* marcas sutis das cenas na barra */
  function marcas() {
    el.trilho.querySelectorAll(".po-mk").forEach(x => x.remove());
    const T = total(); cenas().forEach((b, i) => { if (!i || !(b.de > 0) || b.de >= T) return;
      const m = document.createElement("div"); m.className = "po-mk"; m.style.left = (b.de / T * 100) + "%"; el.trilho.appendChild(m); });
  }
  marcas();
  const cenaEm = (t) => { const B = cenas(); let i = -1; for (let k = 0; k < B.length; k++) if (t >= B[k].de) i = k; return i; };

  /* ---------------- volume geral (voz + música + efeitos) ---------------- */
  const midias = () => ["audio", "musica", "sfx"].map(G).filter(a => a && typeof a.volume === "number");
  const base = new Map(); midias().forEach(a => base.set(a, a.volume));
  let V = { v: 1, mudo: false };
  try { Object.assign(V, JSON.parse(localStorage.getItem(CHAVE) || "{}")); } catch (e) {}
  function aplicaVol() {
    const v = V.mudo ? 0 : Math.max(0, Math.min(1, V.v));
    for (const a of midias()) { if (!base.has(a)) base.set(a, a.volume); a.volume = Math.max(0, Math.min(1, base.get(a) * v)); }
    el.vol.value = Math.round((V.mudo ? 0 : V.v) * 100);
    el.mute.innerHTML = v === 0 ? I.mudo : I.vol;
    el.volBox.classList.toggle("mudo", v === 0); el.volBox.classList.toggle("baixo", v > 0 && v < .5);
    el.vol.style.background = "";
    try { localStorage.setItem(CHAVE, JSON.stringify(V)); } catch (e) {}
  }
  el.vol.addEventListener("input", () => { V.v = +el.vol.value / 100; V.mudo = V.v === 0; aplicaVol(); });
  el.mute.addEventListener("click", () => { if (V.mudo || V.v === 0) { V.mudo = false; if (V.v === 0) V.v = .8; } else V.mudo = true; aplicaVol(); });
  aplicaVol();

  /* ---------------- botões ---------------- */
  const pisca = (icone) => { flash.innerHTML = icone; flash.classList.remove("vai"); void flash.offsetWidth; flash.classList.add("vai"); };
  const alterna = () => { const ia = !tocando(); playPause(); fixo.classList.add("ja"); pisca(ia ? I.play : I.pausa); };
  el.play.addEventListener("click", () => { playPause(); fixo.classList.add("ja"); });
  vp.addEventListener("click", (ev) => { if (ev.target.closest("a,button,input")) return; alterna(); });
  vp.addEventListener("dblclick", (ev) => { ev.preventDefault(); telaCheia(); });
  el.tgs.forEach(b => b.addEventListener("click", () => { const o = orig(b.dataset.o); if (o) o.click(); estado(); }));
  el.vels.forEach(b => b.addEventListener("click", () => { const o = orig(`[data-sp="${b.dataset.v}"]`); if (o) o.click(); estado(); }));
  el.rend.addEventListener("click", () => { try { window.RenderOuro && window.RenderOuro.abrir && window.RenderOuro.abrir(); } catch (e) { console.error("RenderOuro:", e); } });

  /* ---------------- tela cheia (o bloco do vídeo, com a barra) ---------------- */
  const emCheia = () => (document.fullscreenElement || document.webkitFullscreenElement) === fixo;
  function telaCheia() {
    if (emCheia()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const f = fixo.requestFullscreen || fixo.webkitRequestFullscreen; if (f) Promise.resolve(f.call(fixo)).catch(() => {});
  }
  el.fs.addEventListener("click", telaCheia);
  function enquadra() {   // em tela cheia o palco cabe inteiro (letterbox), centralizado
    const stage = document.getElementById("stage"); if (!stage) return;
    if (!emCheia()) { chama("fit"); return; }
    const W = +G("W") || 1920, H = +G("H") || 1080, w = vp.clientWidth, h = vp.clientHeight, k = Math.min(w / W, h / H);
    stage.style.transform = `translate(${((w - W * k) / 2).toFixed(1)}px,${((h - H * k) / 2).toFixed(1)}px) scale(${k})`;
  }
  const reenquadra = () => { enquadra(); requestAnimationFrame(enquadra); setTimeout(enquadra, 160); };
  document.addEventListener("fullscreenchange", () => { el.fs.innerHTML = emCheia() ? I.sair : I.cheia; el.fs.title = emCheia() ? "Sair da tela cheia (F)" : "Tela cheia (F)"; reenquadra(); });
  document.addEventListener("webkitfullscreenchange", reenquadra);
  addEventListener("resize", () => { if (emCheia()) enquadra(); });

  /* ---------------- barra de progresso: arrastar + prévia do tempo ---------------- */
  let arr = false;
  const tDe = (ev) => { const r = el.trilho.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width))) * total(); };
  function mostraTip(t) {
    const T = total(), p = t / T * 100, i = cenaEm(t), B = cenas();
    el.hov.style.width = p + "%"; el.tipT.textContent = mmss(t);
    el.tipC.textContent = B[i] ? `${String(i + 1).padStart(2, "0")} · ${B[i].nome || ""}` : "";
    const r = el.prog.getBoundingClientRect(), wt = el.tip.offsetWidth || 120, x = p / 100 * r.width;
    el.tip.style.left = Math.max(wt / 2, Math.min(r.width - wt / 2, x)) + "px";
  }
  el.prog.addEventListener("pointerdown", (ev) => { if (ev.button !== 0) return; arr = true; el.prog.classList.add("arr"); el.prog.setPointerCapture(ev.pointerId);
    const t = tDe(ev); pular(t); mostraTip(t); desenha(t); ev.preventDefault(); });
  el.prog.addEventListener("pointermove", (ev) => { const t = tDe(ev); mostraTip(t); if (arr) { pular(t); desenha(t); } });
  const solta = () => { arr = false; el.prog.classList.remove("arr"); };
  el.prog.addEventListener("pointerup", solta); el.prog.addEventListener("pointercancel", solta);

  /* ---------------- atalhos (captura: o player antigo usa espaço/←/→ e não deve disparar de novo) ---------------- */
  addEventListener("keydown", (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const tg = ev.target, tag = ((tg && tg.tagName) || "").toLowerCase();
    if (tag === "textarea" || tag === "select" || (tg && tg.isContentEditable)) return;
    if (tag === "input" && !/^(range|checkbox|button)$/i.test(tg.type || "")) return;
    const k = ev.code;
    if (k === "Space") { ev.preventDefault(); ev.stopPropagation(); if (!ev.repeat) alterna(); }
    else if ((k === "ArrowRight" || k === "ArrowLeft") && tag !== "input") { ev.preventDefault(); ev.stopPropagation(); pular(agora() + (k === "ArrowRight" ? 5 : -5)); }
    else if (k === "KeyF" && !ev.shiftKey) { ev.preventDefault(); ev.stopPropagation(); telaCheia(); }
    else if (k === "KeyM" && !ev.shiftKey) { ev.stopPropagation(); el.mute.click(); }
  }, true);

  /* ---------------- estado (a cada quadro) ---------------- */
  let ultT = -1, ultTot = -1, ultPlay = null;
  function desenha(t) {
    const T = total(), p = Math.max(0, Math.min(1, t / T)) * 100;
    el.fill.style.width = p + "%"; el.knob.style.left = `calc(${p}% )`;
  }
  function estado() {
    el.tgs.forEach(b => { const o = orig(b.dataset.o); b.classList.toggle("on", !!(o && o.classList.contains("on"))); });
    const r = +G("rate") || 1; el.vels.forEach(b => b.classList.toggle("on", Math.abs(+b.dataset.v - r) < 1e-6));
  }
  function quadro() {
    const t = agora(), T = total(), tp = tocando();
    if (!arr && Math.abs(t - ultT) > 1e-3) desenha(t);
    if (Math.floor(t) !== Math.floor(ultT) || ultT < 0) el.atual.textContent = mmss(t);
    ultT = t;
    if (T !== ultTot) { el.tot.textContent = mmss(T); ultTot = T; marcas(); }
    if (tp !== ultPlay) { el.play.innerHTML = tp ? I.pausa : I.play; el.play.setAttribute("aria-label", tp ? "Pausar" : "Tocar"); fixo.classList.toggle("tocando", tp); if (tp) fixo.classList.add("ja"); ultPlay = tp; }
    if (window.RenderOuro && !el.rend.classList.contains("vis")) el.rend.classList.add("vis");
    requestAnimationFrame(quadro);
  }
  /* ---------------- tamanho: o vídeo ocupa o que sobra da tela depois da timeline (entre 45% e 60% da altura) ---------------- */
  let ultH = 0;
  function dimensiona() {
    if (emCheia()) return;
    const tl = document.getElementById("tlOuro"), det = tl && tl.querySelector(".det");
    const tlH = tl && tl.offsetHeight ? tl.offsetHeight - (det ? det.offsetHeight : 0) + 12 : 0;   // sem o painel de detalhes (ele não faz o vídeo pular)
    const vh = innerHeight, resto = bar.offsetHeight + 18 + 6;
    const max = Math.min(vh * .6, 720), min = Math.min(max, Math.max(240, vh * .45));
    const h = Math.round(Math.max(min, Math.min(max, vh - tlH - resto)));
    if (h !== ultH) { ultH = h; fixo.style.setProperty("--poH", h + "px"); chama("fit"); }
  }
  const tlObs = () => { const tl = document.getElementById("tlOuro"); if (tl && window.ResizeObserver) new ResizeObserver(() => dimensiona()).observe(tl); };
  addEventListener("resize", dimensiona);
  estado(); setInterval(estado, 500);
  // o palco foi para dentro do bloco fixo: recalcula a escala
  dimensiona(); chama("fit"); requestAnimationFrame(() => { dimensiona(); chama("fit"); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { tlObs(); dimensiona(); }); else tlObs();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dimensiona(); chama("fit"); });
  addEventListener("load", () => { dimensiona(); chama("fit"); });
  requestAnimationFrame(quadro);
  window.PLAYER_OURO = { pronto: true, telaCheia, alterna, fixo };
})();
