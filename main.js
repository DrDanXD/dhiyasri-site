import * as THREE from 'three';
import { buildKnit, knitMaterial, KNITS } from './knit.js';

window.__knitReady = true;
const BG = '#F6F3EC';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/* ——— drag-to-rotate with inertia ——— */
function draggable(el, state) {
  let down = false, lx = 0, ly = 0;
  el.addEventListener('pointerdown', e => { down = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture?.(e.pointerId); state.touched = true; });
  el.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    state.vy = dx * 0.006; state.vx = dy * 0.004;
    state.yaw += state.vy; state.pitch = clamp(state.pitch + state.vx, -0.7, 0.7);
  });
  const up = () => { down = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  state.step = () => {
    if (down || reduce) { if (reduce) { state.vx = state.vy = 0; } return; }
    state.vy *= 0.93; state.vx *= 0.93; state.yaw += state.vy; state.pitch = clamp(state.pitch + state.vx, -0.7, 0.7);
  };
}

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  r.setClearColor(0x000000, 0);
  return r;
}

function whenVisible(el, cb) {
  const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { rootMargin: '100px' });
  io.observe(el);
}

/* ——— HERO: one loop → fabric → T-shirt ——— */
function initHero() {
  const canvas = document.getElementById('heroCanvas');
  const hero = document.getElementById('hero');
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
  const W = 37, C = 47;
  const geo = buildKnit('jersey', W, C, { tee: true, seg: 22, radial: 7 });
  const mat = knitMaterial(BG);
  mat.uniforms.uHalfW.value = geo.userData.halfW;
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group(); group.add(mesh); scene.add(group);
  const halfW = geo.userData.halfW, halfH = geo.userData.halfH;
  const rot = { yaw: 0, pitch: 0, vx: 0, vy: 0 };
  draggable(document.getElementById('heroStage'), rot);

  const stages = [...document.querySelectorAll('.stages li')];
  const live = document.getElementById('stageLive');
  const stageText = ['Showing a single knitted loop', 'Showing knitted jersey fabric', 'Showing a T-shirt made from the fabric'];
  let curStage = -1, visible = true, pS = 0;
  const fovT = Math.tan(THREE.MathUtils.degToRad(35 / 2));

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  whenVisible(hero, v => (visible = v));

  function progress() {
    const r = hero.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight), 0, 1);
  }

  const t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const pT = progress();
    const dt = Math.min(0.1, (now - (frame.last || now)) / 1000); frame.last = now;
    pS = reduce ? pT : lerp(pS, pT, 1 - Math.exp(-dt * 7));
    if (Math.abs(pS - pT) < 0.002 || dt === 0.1) pS = dt === 0.1 ? lerp(pS, pT, 0.6) : pT;
    const p = pS, a = camera.aspect, mobile = a < 0.9;
    const zoom = ease(range(p, 0.06, 0.46)), morph = ease(range(p, 0.5, 0.86));

    // camera distance: single loop → swatch filling frame → whole tee in frame
    const dLoop = mobile ? 8 : 6.4;
    const dSwatch = mobile ? 34 : 34;
    const dTee = Math.max((halfH * 1.42) / fovT, (halfW * 1.3) / (fovT * a)) * (mobile ? 1.05 : 1);
    let d = dLoop * Math.pow(dSwatch / dLoop, zoom);
    d = lerp(d, dTee, morph);
    // keep focal point clear of the headline: right on desktop, upper on mobile
    const offX = mobile ? 0 : -d * fovT * a * lerp(0.34, 0.4, morph);
    const offY = mobile ? -d * fovT * 0.3 : -d * fovT * lerp(0.04, 0.1, morph);
    camera.position.set(offX, offY, d); camera.lookAt(offX, offY, 0);

    const t = (now - t0) / 1000;
    rot.step();
    const idle = reduce ? 0 : Math.sin(t * 0.35) * 0.05;
    group.rotation.y = rot.yaw + lerp(0.22, 0.12, zoom) * (1 - morph) + idle + morph * Math.sin(t * 0.4) * (reduce ? 0 : 0.06);
    group.rotation.x = rot.pitch + lerp(-0.12, -0.05, zoom) * (1 - morph);

    // focus: one loop → a round swatch beside the headline → the whole cloth as it becomes a tee
    mat.uniforms.uFocus.value = lerp(lerp(0.85, 8.5, Math.pow(zoom, 1.6)), 95, morph);
    mat.uniforms.uMorph.value = morph;
    mat.uniforms.uBend.value = morph;
    renderer.render(scene, camera);

    const s = p < 0.3 ? 0 : p < 0.66 ? 1 : 2;
    if (s !== curStage) {
      curStage = s;
      stages.forEach((li, i) => { li.classList.toggle('is-on', i === s); i === s ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current'); });
      if (live) live.textContent = stageText[s];
    }
  }
  requestAnimationFrame(frame);
}

/* ——— KNIT SWITCHER ——— */
function initViewer() {
  const canvas = document.getElementById('knitCanvas');
  const box = document.getElementById('viewer');
  const tag = document.getElementById('viewerTag');
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const mat = knitMaterial('#FAF8F3');
  mat.uniforms.uFocus.value = 9.5;
  const group = new THREE.Group(); scene.add(group);
  const cache = {}; let mesh = null, scaleT = 1, scale = 1, visible = false;
  const rot = { yaw: 0, pitch: 0, vx: 0, vy: 0 };
  draggable(box, rot);

  function setKnit(k) {
    if (!cache[k]) cache[k] = buildKnit(k, 15, 15, { seg: 22, radial: 8 });
    if (mesh) group.remove(mesh);
    mesh = new THREE.Mesh(cache[k], mat); group.add(mesh);
    mat.uniforms.uFuzz.value = k === 'fleece' ? 1 : 0;
    tag.textContent = `[${KNITS[k].name}${k === 'fleece' ? ' — face + brushed back' : k === 'terry' ? ' — pile loops' : ''}]`;
    if (!reduce) scale = 0.86;
  }
  document.querySelectorAll('.knit-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.knit-btn').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    setKnit(btn.dataset.knit);
  }));
  setKnit('jersey');

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.set(0, 0, (w < 500 ? 23 : 18)); camera.lookAt(0, 0, 0);
  }
  new ResizeObserver(resize).observe(box); resize();
  whenVisible(box, v => (visible = v));
  const t0 = performance.now();
  (function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - t0) / 1000;
    rot.step();
    scale = lerp(scale, scaleT, 0.12);
    // slow sway shows both faces — important for fleece, interlock and terry
    const sway = reduce ? 0.5 : Math.sin(t * 0.45) * 0.75;
    group.rotation.set(rot.pitch - 0.38, rot.yaw + sway, 0);
    group.scale.setScalar(scale);
    renderer.render(scene, camera);
  })(t0);
}

/* ——— THE YARN LINE ——— */
function initYarn() {
  const flow = document.getElementById('flow');
  const svg = document.getElementById('yarn');
  const [ghost, glow, glow2, line] = ['.yarn-ghost', '.yarn-glow', '.yarn-glow2', '.yarn-line'].map(s => svg.querySelector(s));
  const dotsG = svg.querySelector('.yarn-dots');
  const steps = [...document.querySelectorAll('.step')];
  let samples = [], total = 0, dots = [];

  function build() {
    const fr = flow.getBoundingClientRect();
    svg.setAttribute('height', fr.height); svg.style.height = fr.height + 'px';
    svg.setAttribute('viewBox', `0 0 ${fr.width} ${fr.height}`);
    const anchors = [...flow.querySelectorAll('.anchor')].map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left - fr.left, y: r.top - fr.top, h: el.dataset.a === 'h', dot: el.hasAttribute('data-dot'), loop: el.hasAttribute('data-loop'), el };
    });
    let d = `M ${anchors[0].x} ${anchors[0].y - 60}`;
    let prev = { x: anchors[0].x, y: anchors[0].y - 60, h: false };
    for (const a of anchors) {
      if (prev.h && a.h && Math.abs(prev.y - a.y) < 2) d += ` L ${a.x} ${a.y}`;
      else {
        const k = Math.max(40, Math.abs(a.y - prev.y) * 0.5), kh = Math.min(k, 90);
        const c1 = prev.h ? [prev.x + kh, prev.y] : [prev.x, prev.y + k];
        const c2 = a.h ? [a.x - kh, a.y] : [a.x, a.y - k];
        d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${a.x} ${a.y}`;
      }
      if (a.loop) {
        // one knitted loop at each process step: the yarn wraps round its marker
        const R = 16;
        for (let i = 1; i <= 24; i++) {
          const s = i / 24, th = s * Math.PI * 2;
          d += ` L ${a.x + R * Math.sin(th) * 1.15} ${a.y - R * (1 - Math.cos(th))}`;
        }
      }
      prev = a;
    }
    const last = anchors[anchors.length - 1];
    d += ` L ${last.x} ${last.y + 24}`;
    [ghost, glow, glow2, line].forEach(p => p.setAttribute('d', d));
    total = line.getTotalLength();
    [glow, glow2, line].forEach(p => { p.style.strokeDasharray = `${total} ${total}`; });
    samples = [];
    for (let l = 0; l <= total; l += 6) samples.push([l, line.getPointAtLength(l).y]);
    // dot markers
    dotsG.innerHTML = '';
    dots = anchors.filter(a => a.dot).map(a => {
      const ns = 'http://www.w3.org/2000/svg';
      const halo = document.createElementNS(ns, 'circle'); halo.setAttribute('cx', a.x); halo.setAttribute('cy', a.y); halo.setAttribute('r', 11); halo.classList.add('halo');
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', a.x); c.setAttribute('cy', a.y); c.setAttribute('r', 3.5);
      dotsG.append(halo, c);
      return { y: a.y, c, halo, step: a.el.closest('.step') };
    });
    update();
  }

  function update() {
    const fr = flow.getBoundingClientRect();
    const head = reduce ? Infinity : innerHeight * 0.62 - fr.top;
    let len = total;
    if (head !== Infinity) {
      len = 0;
      for (const [l, y] of samples) { if (y > head) break; len = l; }
    }
    [glow, glow2, line].forEach(p => { p.style.strokeDashoffset = total - len; });
    for (const d of dots) {
      const on = d.y <= head + 1;
      d.c.classList.toggle('on', on); d.halo.classList.toggle('on', on);
      if (d.step) d.step.classList.toggle('is-on', on);
    }
  }
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  let rt; const rb = () => { clearTimeout(rt); rt = setTimeout(build, 120); };
  addEventListener('resize', rb);
  new ResizeObserver(rb).observe(flow);
  document.fonts?.ready.then(build);
  build();
}

/* ——— year ticks (one per year) are CSS; reveals + form ——— */
function initUI() {
  const rv = document.querySelectorAll('.sec .h2, .sec .lead, .facts, .who-num, .photos, .knit-ui, .gsm-num, .made, .brand-list, .cards, .form');
  rv.forEach(el => el.classList.add('rv'));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  rv.forEach(el => io.observe(el));

  const form = document.getElementById('quoteForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    document.getElementById('formStatus').textContent = name
      ? `Thank you, ${name}. This form is a preview and is not connected yet — please reach us at [email / WhatsApp to confirm].`
      : 'Please add your name. (This form is a preview and is not connected yet.)';
  });
}

initUI();
initYarn();
if (hasWebGL()) {
  try { initHero(); initViewer(); }
  catch (err) { console.warn('WebGL init failed', err); document.documentElement.classList.add('no-webgl'); window.__knitFallback?.(); }
} else {
  document.documentElement.classList.add('no-webgl'); window.__knitFallback?.();
}
