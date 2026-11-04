/* =====================================================================
   GTA-Studio · MOTOR IGOR — motor dos vídeos HTML na linha editorial do Igor
   (inteligencia/linha-editorial-visual.md + biblioteca/estilos/hud-leonida)
   ---------------------------------------------------------------------
   A voz é o relógio. Cada cena (B) começa numa frase da narração e cada peça
   entra numa palavra (w('palavra')). Fundos = clipes em tela cheia, corte seco.
   Contrato com motor/player-ouro.js, timeline-ouro.js e renderiza.py:
     globais clock, playing, TOTAL, BEATS, rate, curB, audio, musica, sfx,
     funções toca(), pausa(), vaiPara(t), fit(), montaBeat(i); W=1920,H=1080.
   Modos: ?rec=1 (gravação: carrega tudo) · ?tlprev=1 (mini-prévia muda).
   ===================================================================== */
const W = 1920, H = 1080;
const REC = /[?&]rec=1\b/.test(location.search), MINI = /[?&]tlprev=1\b/.test(location.search);
/* QUALIDADE INTEIRA sempre (regra inegociável do Igor, 04/11/2026): prévia e gravação usam os mesmos clipes 1080p de media/ */
const MEDIA = 'media/';
const PAL = window.PAL || [], FR = window.FRASES || [];
const stage = document.getElementById('stage'), cam = document.getElementById('cam');
let root = cam;

/* ---------- utilidades ---------- */
function $(tag, cls, parent, css, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (css) Object.assign(e.style, css); if (html != null) e.innerHTML = html; (parent || root).appendChild(e); return e; }
const nrm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function wAbs(txt, after) { const k = nrm(txt); for (const x of PAL) { if (x.s >= after - .05 && nrm(x.t).startsWith(k)) return x.s; } console.warn('palavra não achada:', txt, after); return after; }
const F = id => { const f = FR.find(f => f.id === id); if (!f) { console.warn('frase?', id); return 0; } return Math.max(0, f.inicio - .12); };

/* ---------- sons das peças na tela (HUD.onSom) → coletados por ?sfxlog=1 para o montador gerar sfx.mp3 ---------- */
let SOM_LOG = null, buildDe = 0, MOT_LOG = null, buildIdx = 0;
/* motion na timeline: cada peça na tela vira um ponto {tipo, t, c} (coletaMotion → window.MOTION_EVENTOS) */
const NOME_MO = { card: 'cartela', card2: 'cartela', fala: 'fala', meme: 'meme', logo: 'logo/clarão', barra: 'barras', barraVai: 'barra muda',
  mapa: 'minimapa', roda: 'roda', escolhe: 'seleção', notif: 'notificação', estrela: 'estrelas', numero: 'contador', seta: 'seta' };
function marcaMotion(tipo, t) { if (MOT_LOG && t >= 0 && t < 900) MOT_LOG.push({ tipo, t: +(buildDe + t).toFixed(3), c: buildIdx + 1 }); }
if (window.HUD) HUD.onSom = (tipo, t) => { if (SOM_LOG && t >= 0) SOM_LOG.push([+(buildDe + t).toFixed(3), tipo]); marcaMotion(NOME_MO[tipo] || tipo, t); };
function coletaMotion() {
  MOT_LOG = []; for (let i = 0; i < BEATS.length; i++) montaBeat(i);
  const r = MOT_LOG.filter(e => { const b = BEATS[e.c - 1]; return b && e.t >= b.de - .001 && e.t < b.ate; }).sort((a, b) => a.t - b.t);
  MOT_LOG = null; curB = -1;
  const out = []; for (const e of r) { const p = out[out.length - 1]; if (p && p.tipo === e.tipo && Math.abs(p.t - e.t) < .05) continue; out.push(e); }
  return out;
}
function coletaSons() { SOM_LOG = []; for (let i = 0; i < BEATS.length; i++) montaBeat(i); const r = SOM_LOG.filter(e => { const b = BEATS.find(b => e[0] >= b.de - .001 && e[0] < b.ate); return !!b; }); SOM_LOG = null; curB = -1; return r; }

/* ---------- vídeos: um <video> por arquivo, sincronizado pelo relógio ---------- */
const VPOOL = {}; let VIDS = [];
function vel(src) { if (!VPOOL[src]) { const v = document.createElement('video'); v.src = MEDIA + src; v.muted = true; v.playsInline = true; v.preload = REC ? 'auto' : 'none'; VPOOL[src] = v; } return VPOOL[src]; }
function videoEm(parent, src, t0, t1, { ini = 0, rate: r = 1, css = {} } = {}) {
  const v = vel(src); v.removeAttribute('style');
  Object.assign(v.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }, css);
  parent.appendChild(v); VIDS.push({ v, t0, t1, ini, rate: r }); return v;
}

/* ---------- cenas ---------- */
const BEATS = [];
let CAM_F = null;   // camada de fundos da cena (embaixo de tudo)
const B = (id, nome, fn) => BEATS.push({
  de: F(id), nome, id,
  clipes: [...new Set((String(fn).match(/'([\w\-]+\.mp4)'/g) || []).map(s => s.slice(1, -1)))],
  build(w, D) { const tl = gsap.timeline(); CAM_F = $('div', 'abs', root, { inset: 0, overflow: 'hidden', background: '#000' }); CAM_F.dataset.fundo = '1'; fn(tl, w, D); return tl; }
});

/* fundo em tela cheia, limpo, com zoom lento (Ken Burns) — uma passada do clipe, sem voltar ao começo */
function cheio1(tl, src, t0, t1, { ini = 0, rate: r = 1, z = [1, 1.05], filtro = '', x = 0 } = {}) {
  const box = $('div', 'abs', CAM_F, { inset: 0, overflow: 'hidden' });
  const inner = $('div', 'abs', box, { inset: 0 });
  videoEm(inner, src, t0, t1, { ini, rate: r, css: filtro ? { filter: filtro } : {} });
  gsap.set(box, { autoAlpha: 0 }); tl.set(box, { autoAlpha: 1 }, t0); if (t1 < 999) tl.set(box, { autoAlpha: 0 }, t1);
  tl.fromTo(inner, { scale: z[0], xPercent: 0 }, { scale: z[1], xPercent: x, duration: Math.max(.2, Math.min(t1, 120) - t0), ease: 'none', immediateRender: false }, t0);
  return box;
}

/* ---------- sem loop: se a cena fica mais tempo que o clipe, estica um pouco ou completa com planos inéditos ----------
   window.DURS {nome: segundos}, window.GRUPO {nome: 'gta6'|'gta5'|'retro'}, window.RESERVA {grupo: [nomes]},
   window.FILL {idCena: [nomes]} (planejado pelo montador com ?planfill=1). */
let CUR_D = 99, CUR_ID = '', FILL_K = 0;
const PLAN_FILL = /[?&]planfill=1\b/.test(location.search) ? {} : null;
function proxFill(grupo) {
  if (PLAN_FILL) { const R = window.RESERVA || {}; const pool = R[grupo] && R[grupo].length ? R[grupo] : (R.gta6 || []); const n = pool.shift(); if (n) (PLAN_FILL[CUR_ID] = PLAN_FILL[CUR_ID] || []).push(n); return n; }
  const l = (window.FILL || {})[CUR_ID] || []; return l[FILL_K++];
}
function cheio(tl, src, t0, t1, o = {}) {
  const DU = window.DURS || {}, base = src.replace(/\.mp4$/, ''), ini = o.ini || 0;
  const te = Math.min(t1, CUR_D), need = te - t0, avail = (DU[base] ?? 99) - ini - .15;
  if (need <= avail + .05 || need <= 0) return cheio1(tl, src, t0, t1, o);
  if (avail >= need * .62) return cheio1(tl, src, t0, t1, Object.assign({}, o, { rate: (o.rate || 1) * avail / need }));
  const r = .85; let t = t0 + Math.max(.4, avail / r);
  const box = cheio1(tl, src, t0, t, Object.assign({}, o, { rate: r }));
  const grupo = (window.GRUPO || {})[base] || 'gta6';
  for (let k = 0; k < 10 && t < te - .02; k++) {
    const n = proxFill(grupo);
    if (!n) { cheio1(tl, src, t, t1, Object.assign({}, o, { ini: 0, rate: .7 })); return box; }
    const a = (DU[n] ?? 4) - .15, resto = te - t;
    if (resto <= a / .62) { cheio1(tl, n + '.mp4', t, t1, { z: o.z, filtro: o.filtro, rate: Math.min(1, a / resto) }); return box; }
    cheio1(tl, n + '.mp4', t, t + a, { z: o.z, filtro: o.filtro }); t += a;
  }
  return box;
}
/* verificador (motor/verifica_video.py): janelas de cada clipe + buracos sem imagem que não são preto proposital */
function diagnostico(passo = .25) {
  const jan = [], buracos = [];
  const pretoProposital = () => [...root.querySelectorAll('div')].some(e => {
    if (e.dataset.fundo) return false;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < .5) return false;
    let p = e; while (p && p !== root) { const c = getComputedStyle(p); if (c.visibility === 'hidden' || +c.opacity < .05 || c.display === 'none') return false; p = p.parentElement; }
    const bg = cs.backgroundColor; if (!(bg === 'rgb(0, 0, 0)' || bg.startsWith('rgba(0, 0, 0, 0.5'))) return false;
    const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(); return r.width >= s.width * .98 && r.height >= s.height * .98;
  });
  for (let i = 0; i < BEATS.length; i++) {
    montaBeat(i); const b = BEATS[i], D = b.ate - b.de;
    for (const o of VIDS) jan.push({ cena: i + 1, id: b.id, src: o.v.getAttribute('src'), t0: +(b.de + o.t0).toFixed(2), t1: +(b.de + Math.min(o.t1, D)).toFixed(2), ini: o.ini, rate: o.rate });
    let ini = null;
    for (let t = 0; t < D; t += passo) {
      btl.time(Math.min(t, btl.duration()), false);
      const temVideo = VIDS.some(o => t >= o.t0 && t < o.t1 && getComputedStyle(o.v).visibility !== 'hidden');
      const ok = temVideo || pretoProposital();
      if (!ok && ini === null) ini = t;
      if ((ok || t + passo >= D) && ini !== null) { if (t - ini >= .3) buracos.push({ cena: i + 1, id: b.id, nome: b.nome, de: +(b.de + ini).toFixed(2), ate: +(b.de + t).toFixed(2) }); ini = null; }
    }
  }
  curB = -1; return { jan, buracos };
}
function planejaFill() { for (let i = 0; i < BEATS.length; i++) montaBeat(i); curB = -1; return PLAN_FILL; }
/* sequência de planos [[src, t, ini?, opções?], ...] até 'fim' */
function seq(tl, planos, fim, o = {}) { planos.forEach((p, i) => cheio(tl, p[0], p[1], i < planos.length - 1 ? planos[i + 1][1] : fim, Object.assign({ ini: p[2] || 0 }, o, p[3] || {}))); }
/* tela preta */
function preto(tl, t0, t1) { const b = $('div', 'abs', root, { inset: 0, background: '#000' }); gsap.set(b, { autoAlpha: 0 }); tl.set(b, { autoAlpha: 1 }, t0); if (t1 < 999) tl.set(b, { autoAlpha: 0 }, t1); return b; }

/* ---------- áudio: voz = relógio ---------- */
const somFalso = () => ({ paused: true, seeking: false, currentTime: 0, muted: true, volume: 0, playbackRate: 1, src: '', play() { return Promise.resolve(); }, pause() {} });
const mkAudio = (src, pre) => { if (MINI) return somFalso(); const a = new Audio(); a.preload = REC ? 'auto' : pre; a.src = src; return a; };
const AUD = '';   // áudio original sempre (sem versão leve)
const audio = mkAudio(AUD + 'narracao.mp3', 'metadata');
const musica = mkAudio(AUD + 'musica.mp3', 'none'); let musOn = true;
const sfx = mkAudio(AUD + 'sfx.mp3', 'none'); let sfxOn = true;
let legOn = false;
const TOTAL = +(FR[FR.length - 1].fim + 5.5).toFixed(2);   // respiro final: gatinho + escurecimento + fade da música

let clock = 0, playing = false, curB = -1, btl = null, lastNow = performance.now(), rate = 1, speed = 1, arrastando = false;
const lista = document.getElementById('lista'), scrub = document.getElementById('scrub'), tempo = document.getElementById('tempo'), bPlay = document.getElementById('bPlay'), capa = document.getElementById('capa');
const mmss = t => { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };

function prepara() {
  BEATS.sort((a, b) => a.de - b.de);
  BEATS.forEach((b, i) => b.ate = i < BEATS.length - 1 ? BEATS[i + 1].de : TOTAL);
  BEATS.forEach((b, i) => { const e = document.createElement('button'); e.innerHTML = `<i>${String(i + 1).padStart(2, '0')}</i>${b.nome}<small>${mmss(b.de)}</small>`; e.onclick = () => vaiPara(b.de + .01); lista.appendChild(e); });
  BEATS.forEach(b => { const f = (window.FILL || {})[b.id]; if (f) b.clipes.push(...f.map(n => n + '.mp4')); });
  /* gravação: os clipes carregam por cena (aquece = atual + seguinte); carregar os 250 de uma vez travava o 'load' por 45 s */
}
function fit() { const vp = document.getElementById('viewport'); const k = vp.clientWidth / W; stage.style.transform = `scale(${k})`; vp.style.height = H * k + 'px'; }
addEventListener('resize', fit);
function beatAt(t) { let i = 0; for (let k = 0; k < BEATS.length; k++) if (t >= BEATS[k].de) i = k; return i; }
/* carregamento: na gravação, cena atual + seguinte; na prévia, FILA EM ORDEM — primeiro os clipes da cena atual,
   depois as próximas cenas, no máximo 2 baixando ao mesmo tempo (antes: tudo junto → o clipe da tela atrasava) */
const AQUECE_N = 6; let FILA = [];
const carrega = v => { if (v.preload !== 'auto') { v.preload = 'auto'; if (v.readyState === 0 && v.networkState !== 2) v.load(); } };
const pronto = v => v.readyState >= 4 || (v.readyState >= 3 && v.buffered.length && v.buffered.end(v.buffered.length - 1) >= (v.duration || 99) - .3);
function aquece(i) {
  if (REC || MINI) { for (const k of [i, i + 1]) { const b = BEATS[k]; if (!b || (MINI && k > i)) continue; for (const n of b.clipes) carrega(vel(n)); } return; }
  for (const n of BEATS[i].clipes) carrega(vel(n));
  FILA = []; for (let k = i + 1; k <= i + AQUECE_N && k < BEATS.length; k++) for (const n of BEATS[k].clipes) FILA.push(n);
}
function andaFila() {
  if (REC || MINI || curB < 0) return;
  if (!BEATS[curB].clipes.every(n => pronto(vel(n)) || vel(n).networkState === 3)) return;   // a tela atual primeiro
  let baixando = 0;
  for (const n of FILA) { const v = vel(n); if (v.preload === 'auto' && !pronto(v) && v.networkState !== 3) baixando++; }
  for (const n of FILA) { if (baixando >= 2) break; const v = vel(n); if (v.preload !== 'auto') { carrega(v); baixando++; } }
}
if (!REC && !MINI) setInterval(andaFila, 300);
function montaBeat(i) {
  aquece(i);
  gsap.globalTimeline.getChildren(false, true, true).forEach(c => { if (!c.data || c.data !== 'fixo') c.kill(); });
  for (const o of VIDS) o.v.pause(); VIDS = []; cam.innerHTML = ''; root = cam;
  const b = BEATS[i], D = b.ate - b.de;
  const w = (txt, after) => Math.max(0, wAbs(txt, after === undefined ? b.de : after + b.de) - b.de);
  buildDe = b.de; buildIdx = i; CUR_D = D; CUR_ID = b.id; FILL_K = 0; btl = b.build(w, D); btl.pause();
  curB = i; [...lista.children].forEach((e, j) => e.classList.toggle('on', j === i));
  const nT = document.getElementById('nTit'); if (nT) nT.textContent = `${String(i + 1).padStart(2, '0')} · ${b.nome}  (${mmss(b.de)}–${mmss(b.ate)})`;
}
const nFrase = document.getElementById('nFrase'); let frAtual;
function frase(t) { if (!nFrase) return; if (frAtual && t >= frAtual.inicio - .05 && t < frAtual.fim + .3) return; const f = FR.find(f => t >= f.inicio - .05 && t < f.fim + .3) || null; if (f !== frAtual) { frAtual = f; nFrase.textContent = f ? `${f.id} · ${f.texto}` : '—'; } }
let tempoTxt = '';
/* ---------- espera de carregamento (prévia): se um clipe da tela ainda não tem imagem, o relógio PARA e espera,
   em vez de mostrar tela preta / quadro congelado. Log em window.ESPERAS (o verificador lê). ---------- */
let esperando = false, espDesde = 0, espMotivo = ''; window.ESPERAS = [];
let spin = null;
function mostraSpin(on) {
  if (!spin) { spin = document.createElement('div'); Object.assign(spin.style, { position: 'absolute', right: '28px', bottom: '24px', zIndex: 80, padding: '8px 18px', borderRadius: '999px', background: 'rgba(0,0,0,.6)', color: '#fff', font: "700 26px 'Barlow Condensed',sans-serif", letterSpacing: '.06em', pointerEvents: 'none' }); spin.textContent = 'carregando…'; stage.appendChild(spin); }
  spin.style.display = on ? 'block' : 'none';
}
function faltaCarregar() {
  if (REC || MINI || curB < 0) return '';
  const rel = clock - BEATS[curB].de;
  for (const o of VIDS) if (rel >= o.t0 - .05 && rel < o.t1 && o.v.readyState < 3) return o.v.src.split('/').pop();
  if (audio.readyState < 3 && !audio.ended) return 'narracao.mp3';
  return '';
}
function tick() {
  const now = performance.now(); let dt = (now - lastNow) / 1000; lastNow = now; if (dt > .25) dt = .25;
  if (playing && !REC && !MINI) {
    const f = faltaCarregar();
    if (f && !esperando) { esperando = true; espDesde = now; espMotivo = f; for (const a of [audio, musica, sfx]) a.pause(); mostraSpin(true); }
    else if (esperando && (!f || now - espDesde > 12000)) {
      window.ESPERAS.push({ t: +clock.toFixed(2), s: +((now - espDesde) / 1000).toFixed(2), clipe: espMotivo });
      esperando = false; mostraSpin(false); lastNow = now; dt = 0;
      for (const a of [audio, musica, sfx]) { a.currentTime = clock; a.play().catch(() => {}); }
    }
  }
  if (playing && !esperando) {
    clock += dt * rate;
    if (!audio.paused && !audio.seeking && Math.abs(audio.currentTime - clock) > .12) clock = audio.currentTime;
    const vozAcabou = audio.ended || (audio.duration && audio.currentTime >= audio.duration - .05);
    const ref = vozAcabou ? clock : audio.currentTime;   // depois que a voz acaba, quem manda é o relógio (antes: música presa no fim da voz = som em loop)
    for (const a of [musica, sfx]) if (!a.paused && !a.seeking && Math.abs(a.currentTime - ref) > .15) a.currentTime = ref;
    if (clock >= TOTAL) { clock = TOTAL; pausa(); }
  }
  const i = beatAt(clock);
  if (i !== curB) montaBeat(i);
  btl.time(Math.min(Math.max(0, clock - BEATS[i].de), btl.duration()), false);
  const rel = clock - BEATS[i].de, ativo = playing && !esperando;
  for (const o of VIDS) {
    const dur = o.v.duration || 99, span = Math.max(.5, dur - o.ini - .12), loc = o.ini + (Math.max(0, rel - o.t0) * o.rate) % span, on = rel >= o.t0 - .1 && rel < o.t1;
    if (on && ativo) {
      /* tocando: posiciona só na entrada do trecho ou se atrasar muito; diferença pequena = acelera/freia de leve
         (antes: reposicionava a cada 0,25 s de diferença → milhares de pulos para trás, parecendo "loop") */
      const diff = loc - o.v.currentTime;
      if (!o.ok) { o.ok = true; if (Math.abs(diff) > .08 && !o.v.seeking) o.v.currentTime = loc; }
      else if (Math.abs(diff) > .8 && !o.v.seeking && o.v.readyState >= 2) o.v.currentTime = loc;
      o.v.playbackRate = Math.max(.0625, o.rate * rate * (1 + Math.max(-.25, Math.min(.25, diff * .5))));
      if (o.v.paused) o.v.play().catch(() => {});
    }
    else if (ativo) {
      /* tocando, trecho fora da tela: o que já passou fica parado; o que vai entrar é posicionado UMA vez no começo */
      o.ok = false; if (!o.v.paused && !VIDS.some(x => x !== o && x.v === o.v && rel >= x.t0 - .1 && rel < x.t1)) o.v.pause();
      if (rel < o.t0 - .1 && !o.pre && !o.v.seeking && o.v.readyState > 0 && !VIDS.some(x => x !== o && x.v === o.v && rel >= x.t0 - .1 && rel < x.t1)) { o.pre = true; if (Math.abs(o.v.currentTime - o.ini) > .05) o.v.currentTime = o.ini; }
    }
    else { o.ok = false; o.pre = false; if (!o.v.paused) o.v.pause(); if (Math.abs(o.v.currentTime - loc) > .05 && !o.v.seeking && o.v.readyState > 0) o.v.currentTime = loc; }
  }
  frase(clock);
  if (!arrastando) { const sv = String(Math.round(clock / TOTAL * 1000)); if (scrub.value !== sv) scrub.value = sv; }
  const tt = mmss(clock) + ' / ' + mmss(TOTAL); if (tt !== tempoTxt) { tempoTxt = tt; tempo.textContent = tt; }
}
function toca() {
  if (clock >= TOTAL - .05) { clock = 0; curB = -1; }
  speed = rate;
  for (const a of [audio, musica, sfx]) { a.playbackRate = rate; a.currentTime = clock; }
  musica.muted = !musOn; sfx.muted = !sfxOn;
  audio.play().catch(e => console.warn('áudio:', e.message)); musica.play().catch(() => {}); sfx.play().catch(() => {});
  playing = true; bPlay.textContent = '⏸ Pausar'; if (capa) capa.classList.add('off');
}
function pausa() { playing = false; if (esperando) { esperando = false; mostraSpin(false); } audio.pause(); musica.pause(); sfx.pause(); bPlay.textContent = '▶ Tocar'; }
function vaiPara(t) { clock = Math.min(Math.max(0, t), TOTAL - .01); curB = -1; for (const a of [audio, musica, sfx]) a.currentTime = clock; if (playing) { audio.play().catch(() => {}); musica.play().catch(() => {}); sfx.play().catch(() => {}); } }

function liga() {
  prepara(); fit();
  gsap.ticker.add(tick);
  bPlay.onclick = () => playing ? pausa() : toca(); if (capa) capa.onclick = toca;
  document.getElementById('bRe').onclick = () => { vaiPara(0); if (!playing) toca(); };
  document.getElementById('bMus').onclick = e => { musOn = !musOn; musica.muted = !musOn; e.target.classList.toggle('on', musOn); };
  document.getElementById('bSfx').onclick = e => { sfxOn = !sfxOn; sfx.muted = !sfxOn; e.target.classList.toggle('on', sfxOn); };
  document.getElementById('bLeg').onclick = e => { legOn = !legOn; e.target.classList.toggle('on', legOn); };
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { rate = +b.dataset.sp; speed = rate; for (const a of [audio, musica, sfx]) a.playbackRate = rate; document.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('on', x === b)); });
  scrub.oninput = () => { arrastando = true; vaiPara(scrub.value / 1000 * TOTAL); }; scrub.onchange = () => { arrastando = false; };
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Space') { e.preventDefault(); playing ? pausa() : toca(); } if (e.code === 'ArrowRight') vaiPara(clock + 5); if (e.code === 'ArrowLeft') vaiPara(clock - 5); });
  /* recarga automática (só por http): o montador grava versao.txt; volta no mesmo ponto */
  if (location.protocol.startsWith('http') && !REC && !MINI) {
    let v0 = null;
    setInterval(async () => { try { const v = await (await fetch('versao.txt?' + Date.now(), { cache: 'no-store' })).text(); if (v0 === null) v0 = v; else if (v !== v0) { try { sessionStorage.setItem('igclock', String(clock)); } catch (e) {} location.reload(); } } catch (e) {} }, 1500);
    try { const c = +sessionStorage.getItem('igclock'); if (c) { sessionStorage.removeItem('igclock'); setTimeout(() => vaiPara(c), 300); } } catch (e) {}
  }
}
