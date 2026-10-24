// Procedural weft-knit geometry. Every loop is a real stitch path:
// x = cx + W·θ/2π + B·sin2θ,  y = cy + (H/2)·cosθ,  z = −D·cos2θ  (θ ∈ [−π, π])
// Legs sit forward (z+), head and sinker sit back (z−) so neighbouring courses interlock.
import * as THREE from 'three';
const TAU = Math.PI * 2;

// Seeded random so geometry is identical on every visit
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

class Builder {
  constructor() { this.pos = []; this.nor = []; this.loop = []; this.fuzz = []; this.idx = []; }
  tube(curve, segs, radial, radius, loopAttr, fuzz = 0) {
    const base = this.pos.length / 3;
    const P = [];
    for (let i = 0; i <= segs; i++) P.push(curve(i / segs));
    let N = null;
    for (let i = 0; i <= segs; i++) {
      const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, segs)];
      const T = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      if (!N) { N = new THREE.Vector3(0, 0, 1).cross(T); if (N.lengthSq() < 1e-4) N.set(1, 0, 0).cross(T); N.normalize(); }
      else { N.sub(T.clone().multiplyScalar(N.dot(T))).normalize(); } // parallel transport
      const Bv = new THREE.Vector3().crossVectors(T, N).normalize();
      for (let r = 0; r < radial; r++) {
        const ang = (r / radial) * TAU, c = Math.cos(ang), s = Math.sin(ang);
        const nx = N.x * c + Bv.x * s, ny = N.y * c + Bv.y * s, nz = N.z * c + Bv.z * s;
        this.pos.push(P[i][0] + nx * radius, P[i][1] + ny * radius, P[i][2] + nz * radius);
        this.nor.push(nx, ny, nz);
        this.loop.push(loopAttr[0], loopAttr[1], loopAttr[2], loopAttr[3]);
        this.fuzz.push(fuzz);
      }
    }
    for (let i = 0; i < segs; i++) for (let r = 0; r < radial; r++) {
      const a = base + i * radial + r, b = base + (i + 1) * radial + r;
      const c = base + (i + 1) * radial + ((r + 1) % radial), d = base + i * radial + ((r + 1) % radial);
      this.idx.push(a, b, d, b, c, d);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aLoop', new THREE.Float32BufferAttribute(this.loop, 4));
    g.setAttribute('aFuzz', new THREE.Float32BufferAttribute(this.fuzz, 1));
    const n = this.pos.length / 3;
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const loopCurve = (cx, cy, p, flip = 1, zOff = 0) => s => {
  const t = -Math.PI + s * TAU;
  return [cx + p.W * (t / TAU) + p.B * Math.sin(2 * t), cy + (p.H / 2) * Math.cos(t), zOff - flip * p.D * Math.cos(2 * t)];
};

// T-shirt silhouette, normalised to [-1,1] (front view)
const TEE = [[-0.2,1],[-0.1,0.9],[0,0.87],[0.1,0.9],[0.2,1],[0.52,0.93],[0.98,0.56],[0.8,0.34],[0.52,0.5],[0.52,-1],
  [-0.52,-1],[-0.52,0.5],[-0.8,0.34],[-0.98,0.56],[-0.52,0.93]];
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const KNITS = {
  jersey:    { name: 'Single jersey', W: 1, H: 1.75, ch: 0.86, B: 0.2, D: 0.24, r: 0.17 },
  rib:       { name: 'Rib', W: 0.8, H: 1.75, ch: 0.86, B: 0.16, D: 0.22, r: 0.15 },
  interlock: { name: 'Interlock', W: 0.86, H: 1.5, ch: 0.76, B: 0.17, D: 0.18, r: 0.13 },
  fleece:    { name: 'Fleece', W: 1, H: 1.75, ch: 0.86, B: 0.2, D: 0.24, r: 0.15 },
  terry:     { name: 'Terry', W: 1, H: 1.75, ch: 0.86, B: 0.2, D: 0.24, r: 0.14 },
};

// type: knit key; wales/courses: grid; opts.tee: mark loops inside a tee silhouette; opts.seg: tube detail
export function buildKnit(type, wales, courses, opts = {}) {
  const p = KNITS[type];
  const seg = opts.seg || 22, rad = opts.radial || 7;
  const b = new Builder();
  const rand = rng(7 + type.length * 13);
  const x0 = -((wales - 1) / 2) * p.W, y0 = -((courses - 1) / 2) * p.ch;
  const halfW = (wales * p.W) / 2, halfH = (courses * p.ch) / 2;
  const tee = (cx, cy) => (opts.tee ? (inPoly(cx / (halfW * 0.98), cy / (halfH * 0.94), TEE) ? 1 : 0) : 1);

  for (let i = 0; i < courses; i++) {
    for (let j = 0; j < wales; j++) {
      const cx = x0 + j * p.W, cy = y0 + i * p.ch;
      const attr = [cx, cy, tee(cx, cy), rand()];
      if (type === 'rib') {
        const back = j % 2 === 1;  // 1×1 rib: alternate wales knitted on the back bed
        b.tube(loopCurve(cx, cy, p, back ? -1 : 1, back ? -0.3 : 0.12), seg, rad, p.r, attr);
      } else if (type === 'interlock') {
        b.tube(loopCurve(cx, cy, p, 1, 0.19), seg, rad, p.r, attr);                       // front bed
        b.tube(loopCurve(cx + p.W / 2, cy + p.ch / 2, p, -1, -0.19), seg, rad, p.r, attr); // back bed, offset
      } else {
        b.tube(loopCurve(cx, cy, p, 1, 0), seg, rad, p.r, attr);
        if (type === 'terry' && (i + j) % 2 === 0) {
          // pile loop standing proud of the ground fabric
          const zb = 0.12, L = 0.95 + rand() * 0.25, tilt = (rand() - 0.5) * 0.3;
          b.tube(s => [cx + 0.17 * Math.sin(TAU * s) + tilt * Math.sin(Math.PI * s),
                       cy - 0.25 + 0.32 * Math.sin(Math.PI * s) + 0.05 * Math.sin(TAU * s),
                       zb + L * Math.sin(Math.PI * s)], 18, 6, p.r * 0.95, attr);
        }
      }
    }
    if (type === 'fleece') {
      // brushed back yarn floating behind each course
      const ph = rand() * TAU;
      b.tube(s => { const x = -halfW + s * 2 * halfW; return [x, y0 + i * p.ch - 0.25 + 0.1 * Math.sin(x * 1.7 + ph), -0.5 + 0.08 * Math.sin(x * 3.1 + ph)]; },
        wales * 8, 8, 0.24, [0, y0 + i * p.ch, 1, rand()], 1);
    }
  }
  const g = b.geometry();
  g.userData = { halfW, halfH };
  return g;
}

export function knitMaterial(bg) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMorph: { value: 0 }, uFocus: { value: 100 }, uFocusC: { value: new THREE.Vector2() },
      uBend: { value: 0 }, uHalfW: { value: 18 }, uFuzz: { value: 0 }, uTime: { value: 0 },
      uBg: { value: new THREE.Color(bg) }, uYarn: { value: new THREE.Color('#F4F0E7') },
      uRim: { value: new THREE.Color('#3a4cb8') }, uShadow: { value: new THREE.Color('#b9ae9b') },
    },
    vertexShader: /* glsl */`
      attribute vec4 aLoop; attribute float aFuzz;
      uniform float uMorph, uFocus, uBend, uHalfW, uFuzz, uTime; uniform vec2 uFocusC;
      varying vec3 vN; varying vec3 vV; varying float vFocus; varying float vZ; varying float vFz;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        vec3 p = position; vec3 n = normal;
        // loops outside the tee unravel away as the garment forms
        float outside = 1.0 - aLoop.z;
        float k = smoothstep(0.0, 1.0, clamp(uMorph * 1.6 - aLoop.w * 0.6, 0.0, 1.0)) * outside;
        p.xy = aLoop.xy + (p.xy - aLoop.xy) * (1.0 - k);
        p.z = p.z * (1.0 - k) - k * 4.0;
        vZ = position.z;
        // fleece fibres: soft brushed displacement
        float fz = aFuzz * uFuzz * (h(floor(position * 9.0)) - 0.3) * 0.16;
        p += n * fz; vFz = aFuzz;
        // garment wraps round a torso
        float bx = p.x / uHalfW;
        p.z -= uBend * bx * bx * uHalfW * 0.32;
        vFocus = 1.0 - smoothstep(uFocus * 0.45, uFocus, distance(aLoop.xy, uFocusC));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vV = -mv.xyz; vN = normalize(normalMatrix * n);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBg, uYarn, uRim, uShadow;
      varying vec3 vN; varying vec3 vV; varying float vFocus; varying float vZ; varying float vFz;
      void main(){
        if (vFocus < 0.02) discard;                               // outside focus: no occluding ghosts
        vec3 N = normalize(vN); vec3 V = normalize(vV);
        float inner = step(dot(N, V), 0.0);                       // open yarn ends: show as shadowed core
        N = mix(N, -N, inner);
        vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
        float wrap = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
        float ao = smoothstep(-0.55, 0.3, vZ);                  // creases between loops sit deeper
        vec3 col = mix(uShadow, uYarn, 0.28 + 0.72 * wrap * (0.62 + 0.38 * ao));
        vec3 H = normalize(L + V);
        col += pow(max(dot(N, H), 0.0), 28.0) * 0.10;           // soft cotton sheen, no gloss
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col = mix(col, uRim, fres * 0.55);                       // Noyyal indigo rim light
        col = mix(col, col * 0.96 + vec3(0.01), vFz * 0.5);
        col = mix(col, uShadow, inner * 0.6);
        col = mix(uBg, col, 0.035 + 0.965 * vFocus);              // focus: one loop first, then the cloth
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}
