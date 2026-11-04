/* render-ui.js — painel "Renderizar MP4" dos vídeos HTML do GTA-Studio (autocontido).
   window.RenderOuro.abrir()  → abre o painel; .fechar() fecha.
   Pelo servidor (node motor/servidor_previa.mjs → http://127.0.0.1:3920/): escolhe 30/60 fps, dispara POST /api/render,
   mostra progresso/ETA (polling de /api/render/status) e o botão "Baixar MP4".
   Por file:// mostra o comando pronto para copiar. Não existe em ?rec=1 nem ?tlprev=1 (render e prévias). */
(() => {
  if (/[?&](rec|tlprev)=1\b/.test(location.search)) { window.RenderOuro = { abrir() {}, fechar() {} }; return; }
  const PY = "C:\\Users\\Alves\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
  const local = location.protocol === "file:";
  let el = null, timer = null, fps = 30;

  const cor = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--ouro").trim();
    return /^#|^rgb|^hsl/.test(v) ? v : "#1A8CFF";
  };
  const mmss = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const caminhoWin = () => decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, "$1").replace(/\//g, "\\");
  const raizWin = () => { const c = caminhoWin(), i = c.toLowerCase().lastIndexOf("\\videos\\"); return i > 0 ? c.slice(0, i) : null; };
  const arquivoSrv = () => decodeURIComponent(location.pathname).replace(/^\/+/, "");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function estilo() {
    if (document.getElementById("ro-css")) return;
    const s = document.createElement("style"); s.id = "ro-css";
    s.textContent = `
#ro-fundo{position:fixed;inset:0;z-index:2147483600;background:rgba(3,5,8,.62);backdrop-filter:blur(3px);display:grid;place-items:center;padding:16px}
#ro{--ro:#1A8CFF;width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#0e1117;color:#e9ecf1;border:1px solid #232a36;border-radius:16px;
  box-shadow:0 24px 70px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.02),0 0 40px color-mix(in srgb,var(--ro) 18%,transparent);
  font:14px/1.45 Inter,system-ui,sans-serif;padding:20px 22px 22px}
#ro *{box-sizing:border-box;position:static;float:none;text-transform:none;letter-spacing:normal;transform:none}
#ro h2{margin:0;font:900 20px Montserrat,Inter,sans-serif;letter-spacing:.02em;color:var(--ro);display:flex;align-items:center;gap:10px}
#ro .ro-x{all:unset;cursor:pointer;margin-left:auto;color:#8a93a3;font-size:22px;line-height:1;padding:2px 6px;border-radius:6px}
#ro .ro-x:hover{color:#fff;background:#1a1f29}
#ro p.ro-sub{margin:4px 0 16px;color:#8a93a3;font-size:13px}
#ro .ro-lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a93a3;margin:0 0 8px}
#ro .ro-seg{display:flex;gap:8px;margin-bottom:16px}
#ro .ro-seg button{all:unset;cursor:pointer;flex:1;text-align:center;padding:10px 0;border-radius:10px;border:1px solid #232a36;background:#121620;font-weight:700}
#ro .ro-seg button small{display:block;font-weight:500;color:#8a93a3;font-size:11px}
#ro .ro-seg button.ro-on{border-color:var(--ro);color:var(--ro);box-shadow:inset 0 0 0 1px var(--ro)}
#ro .ro-go{all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;text-align:center;padding:13px 0;border-radius:12px;background:var(--ro);color:#0b0d11;
  font:900 16px Montserrat,Inter,sans-serif;letter-spacing:.02em;box-shadow:0 0 26px color-mix(in srgb,var(--ro) 45%,transparent)}
#ro .ro-go:hover{filter:brightness(1.08)} #ro .ro-go[disabled]{opacity:.45;cursor:default;box-shadow:none}
#ro .ro-go.ro-sec{background:#121620;color:var(--ro);border:1px solid var(--ro);box-shadow:none;margin-top:10px}
#ro .ro-barra{height:12px;border-radius:999px;background:#151a23;border:1px solid #232a36;overflow:hidden;margin:16px 0 8px}
#ro .ro-barra i{display:block;height:100%;width:0;background:linear-gradient(90deg,color-mix(in srgb,var(--ro) 60%,#fff 0%),var(--ro));
  box-shadow:0 0 14px var(--ro);transition:width .5s}
#ro .ro-linha{display:flex;justify-content:space-between;gap:10px;color:#cfd5df;font-size:13px;font-variant-numeric:tabular-nums;flex-wrap:wrap}
#ro .ro-msg{margin-top:8px;color:#8a93a3;font-size:12.5px;min-height:18px;word-break:break-word}
#ro .ro-msg.ro-err{color:#ff6b7a}
#ro pre{margin:0 0 10px;background:#080a0e;border:1px solid #232a36;border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-all;
  font:12.5px/1.5 ui-monospace,Consolas,monospace;color:#d8e6ff}
#ro .ro-copiar{all:unset;cursor:pointer;font-size:12px;font-weight:700;color:var(--ro);padding:4px 10px;border:1px solid #232a36;border-radius:8px;margin-bottom:14px;display:inline-block}
#ro ol{margin:0 0 6px;padding-left:20px;color:#cfd5df} #ro ol li{margin:4px 0} #ro code{color:#d8e6ff;font-family:ui-monospace,Consolas,monospace;font-size:12.5px}
#ro a{color:var(--ro)}`;
    document.head.appendChild(s);
  }

  function fechar() { clearInterval(timer); timer = null; if (el) el.remove(); el = null; removeEventListener("keydown", tecla, true); }
  function tecla(e) { if (e.key === "Escape") { e.stopPropagation(); fechar(); } }

  function abrir() {
    if (el) return;
    estilo();
    el = document.createElement("div"); el.id = "ro-fundo";
    el.innerHTML = `<div id="ro" role="dialog" aria-label="Renderizar MP4"><h2>Renderizar MP4<button class="ro-x" title="Fechar (Esc)">×</button></h2>
      <p class="ro-sub">Vídeo inteiro, quadro a quadro, em qualidade máxima (H.264 CRF 13 + áudio AAC 320k).</p><div class="ro-corpo"></div></div>`;
    el.querySelector("#ro").style.setProperty("--ro", cor());
    el.addEventListener("click", e => { if (e.target === el) fechar(); });
    el.querySelector(".ro-x").onclick = fechar;
    addEventListener("keydown", tecla, true);
    document.body.appendChild(el);
    local ? telaLocal() : telaServidor();
  }

  function telaLocal() {
    const c = el.querySelector(".ro-corpo"), raiz = raizWin(), html = caminhoWin();
    const motor = raiz ? raiz + "\\motor\\renderiza.py" : "motor\\renderiza.py";
    const cmd = f => `"${PY}" -X utf8 "${motor}" "${html}" --fps ${f}`;
    c.innerHTML = `<div class="ro-lbl">Aberto direto do arquivo (sem servidor)</div>
      <p class="ro-sub" style="margin-top:0">Daqui o navegador não consegue renderizar. Escolha uma das opções:</p>
      <div class="ro-lbl">1 · Rodar no terminal</div>
      <div class="ro-seg"><button data-f="30" class="ro-on">30 fps</button><button data-f="60">60 fps</button></div>
      <pre></pre><button class="ro-copiar">Copiar comando</button>
      <div class="ro-lbl">2 · Abrir pelo servidor (com botão de render e download)</div>
      <ol><li>No terminal, na pasta <code>${esc(raiz || "GTA-Studio")}</code>: <code>node motor/servidor_previa.mjs</code></li>
      <li>Abra <a href="http://127.0.0.1:3920/" target="_blank" rel="noopener">http://127.0.0.1:3920/</a> e escolha este vídeo.</li></ol>
      <div class="ro-msg">O MP4 sai em <code>render\\</code> ao lado do HTML. Progresso em <code>&lt;arquivo&gt;.status.json</code>.</div>`;
    const pre = c.querySelector("pre"), bt = c.querySelector(".ro-copiar");
    const mostra = () => { pre.textContent = cmd(fps); };
    c.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { fps = +b.dataset.f; c.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("ro-on", x === b)); mostra(); });
    bt.onclick = async () => {
      try { await navigator.clipboard.writeText(pre.textContent); }
      catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy"); }
      bt.textContent = "Copiado ✓"; setTimeout(() => { if (bt.isConnected) bt.textContent = "Copiar comando"; }, 1600);
    };
    mostra();
  }

  function telaServidor() {
    const c = el.querySelector(".ro-corpo");
    c.innerHTML = `<div class="ro-lbl">Quadros por segundo</div>
      <div class="ro-seg"><button data-f="30" class="ro-on">30 fps<small>padrão · mais rápido</small></button><button data-f="60">60 fps<small>mais fluido · 2× o tempo</small></button></div>
      <button class="ro-go">Renderizar MP4</button>
      <div class="ro-prog" hidden><div class="ro-barra"><i></i></div>
        <div class="ro-linha"><span class="ro-pct">0%</span><span class="ro-qd"></span><span class="ro-eta"></span></div></div>
      <div class="ro-msg"></div><div class="ro-fim"></div>`;
    c.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { fps = +b.dataset.f; c.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("ro-on", x === b)); });
    const go = c.querySelector(".ro-go"), msg = c.querySelector(".ro-msg");
    go.onclick = async () => {
      go.disabled = true; msg.className = "ro-msg"; msg.textContent = "Iniciando…"; c.querySelector(".ro-fim").innerHTML = "";
      try {
        const r = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arquivo: arquivoSrv(), fps }) });
        const d = await r.json().catch(() => ({}));
        if (r.status === 409) { msg.textContent = "Já tem um render rodando" + (d.arquivo ? ` (${d.arquivo})` : "") + " — acompanhando."; }
        else if (!r.ok) { throw new Error(d.erro || "HTTP " + r.status); }
        acompanha();
      } catch (e) { go.disabled = false; msg.className = "ro-msg ro-err"; msg.textContent = "Não deu para iniciar: " + e.message; }
    };
    // se já houver render deste arquivo rodando/pronto, mostra
    fetch("/api/render/status").then(r => r.json()).then(d => { if (d && d.arquivo && (d.ativo || d.estado === "pronto")) { if (d.ativo) go.disabled = true; pinta(d); if (d.ativo) acompanha(); } }).catch(() => {});
  }

  function acompanha() {
    clearInterval(timer);
    const passo = async () => {
      if (!el) return clearInterval(timer);
      try { const d = await (await fetch("/api/render/status", { cache: "no-store" })).json(); pinta(d); if (!d.ativo) clearInterval(timer); }
      catch (e) { const m = el && el.querySelector(".ro-msg"); if (m) { m.className = "ro-msg ro-err"; m.textContent = "Servidor não respondeu (" + e.message + ")"; } }
    };
    passo(); timer = setInterval(passo, 1000);
  }

  function pinta(d) {
    if (!el) return;
    const c = el.querySelector(".ro-corpo"), go = c.querySelector(".ro-go"), msg = c.querySelector(".ro-msg"), fim = c.querySelector(".ro-fim");
    if (!go) return;
    c.querySelector(".ro-prog").hidden = false;
    const pct = d.estado === "pronto" ? 100 : (d.pct || 0);
    c.querySelector(".ro-barra i").style.width = pct + "%";
    c.querySelector(".ro-pct").textContent = pct.toFixed(pct < 10 ? 1 : 0) + "%";
    c.querySelector(".ro-qd").textContent = d.total ? `${d.quadros || 0} / ${d.total} quadros` + (d.qps ? ` · ${d.qps} q/s` : "") : "";
    c.querySelector(".ro-eta").textContent = d.estado === "pronto" ? "concluído" : d.eta_s != null ? "faltam ~" + mmss(d.eta_s) : "calculando…";
    const outro = d.arquivo && d.arquivo !== arquivoSrv() ? ` · ${d.arquivo}` : "";
    msg.className = "ro-msg" + (d.estado === "erro" ? " err" : "");
    const nomes = { iniciando: "Abrindo a página…", renderizando: "Renderizando", juntando: "Unindo as partes e o áudio…", pronto: "Pronto", erro: "Erro" };
    msg.textContent = (nomes[d.estado] || d.estado || "") + (d.mensagem ? " — " + d.mensagem : "") + (d.decorrido_s ? ` · ${mmss(d.decorrido_s)} decorrido` : "") + outro;
    if (d.ativo) { go.disabled = true; go.textContent = "Renderizando…"; }
    if (d.estado === "pronto" && d.download) {
      go.disabled = false; go.textContent = "Renderizar de novo";
      fim.innerHTML = `<a class="ro-go ro-sec" href="${esc(d.download)}" download="${esc(d.nome || "video.mp4")}">Baixar MP4${d.tamanho_mb ? " · " + d.tamanho_mb + " MB" : ""}</a>`;
    } else if (d.estado === "erro") { go.disabled = false; fim.innerHTML = ""; }
    else fim.innerHTML = "";
  }

  window.RenderOuro = { abrir, fechar };
})();
