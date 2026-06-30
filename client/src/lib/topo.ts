// Procedural terrain contour generator using Perlin-like noise
// Returns SVG path strings for closed contour loops at various elevations

// Mulberry32 — fast deterministic PRNG
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPerm(seed: number): number[] {
  const rng = mulberry32(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function perlin2(seed: number, x: number, y: number): number {
  const perm = buildPerm(seed);
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = perm[perm[X] + Y];
  const ab = perm[perm[X] + Y + 1];
  const ba = perm[perm[X + 1] + Y];
  const bb = perm[perm[X + 1] + Y + 1];
  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

function fbm(seed: number, x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin2(seed + i * 37, x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

function warpedFbm(seed: number, x: number, y: number): number {
  const wx = fbm(seed, x + 1.7, y + 9.2, 3) * 1.5;
  const wy = fbm(seed, x + 8.3, y + 2.8, 3) * 1.5;
  return fbm(seed, x + wx, y + wy, 5, 2, 0.5);
}

function generateHeightmap(
  width: number,
  height: number,
  resolution: number,
  seed: number,
): { w: number; h: number; data: Float32Array; min: number; max: number } {
  const cols = Math.ceil(width / resolution) + 1;
  const rows = Math.ceil(height / resolution) + 1;
  const data = new Float32Array(cols * rows);
  let min = Infinity;
  let max = -Infinity;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i * resolution) / 200;
      const y = (j * resolution) / 200;
      let h = warpedFbm(seed, x, y);
      h += warpedFbm(seed + 1000, x * 0.7, y * 0.7) * 0.4;
      h /= 1.4;
      data[j * cols + i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { w: cols, h: rows, data, min, max };
}

function extractContour(
  heightmap: { w: number; h: number; data: Float32Array; min: number; max: number },
  resolution: number,
  elevation: number,
): [number, number][][] {
  const { w, h, data } = heightmap;
  const segments: [number, number][][] = [];

  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const tl = data[j * w + i];
      const tr = data[j * w + i + 1];
      const br = data[(j + 1) * w + i + 1];
      const bl = data[(j + 1) * w + i];

      const idx =
        (tl > elevation ? 1 : 0) |
        (tr > elevation ? 2 : 0) |
        (br > elevation ? 4 : 0) |
        (bl > elevation ? 8 : 0);

      if (idx === 0 || idx === 15) continue;

      const x0 = i * resolution;
      const y0 = j * resolution;
      const x1 = (i + 1) * resolution;
      const y1 = (j + 1) * resolution;

      const lerpEdge = (va: number, vb: number, ax: number, ay: number, bx: number, by: number): [number, number] => {
        const t = (elevation - va) / (vb - va);
        return [ax + t * (bx - ax), ay + t * (by - ay)];
      };

      const top    = lerpEdge(tl, tr, x0, y0, x1, y0);
      const right  = lerpEdge(tr, br, x1, y0, x1, y1);
      const bottom = lerpEdge(bl, br, x0, y1, x1, y1);
      const left   = lerpEdge(tl, bl, x0, y0, x0, y1);

      switch (idx) {
        case 1:  segments.push([left, top]); break;
        case 2:  segments.push([top, right]); break;
        case 3:  segments.push([left, right]); break;
        case 4:  segments.push([right, bottom]); break;
        case 5:  segments.push([left, top], [right, bottom]); break;
        case 6:  segments.push([top, bottom]); break;
        case 7:  segments.push([left, bottom]); break;
        case 8:  segments.push([bottom, left]); break;
        case 9:  segments.push([bottom, top]); break;
        case 10: segments.push([top, right], [bottom, left]); break;
        case 11: segments.push([right, bottom]); break;
        case 12: segments.push([left, right]); break;
        case 13: segments.push([top, right]); break;
        case 14: segments.push([right, left]); break;
      }
    }
  }
  return segments;
}

// Chain segments into closed polylines with strict tolerance to prevent
// bridging across unrelated contours (which created long straight lines).
function chainSegments(segments: [number, number][][], gridSize: number): [number, number][][] {
  const chains: [number, number][][] = [];
  const remaining: [number, number][][] = segments.map(s => [s[0], s[1]]);
  const tolerance = gridSize * 0.4;

  const dist = (a: [number, number], b: [number, number]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1]);

  while (remaining.length > 0) {
    const seg = remaining.shift()!;
    const chain: [number, number][] = [seg[0], seg[1]];

    let extended = true;
    while (extended) {
      extended = false;
      const head = chain[0];
      const tail = chain[chain.length - 1];

      for (let i = 0; i < remaining.length; i++) {
        const [a, b] = remaining[i];
        if (dist(tail, a) < tolerance) {
          chain.push(b);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (dist(tail, b) < tolerance) {
          chain.push(a);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (dist(head, b) < tolerance) {
          chain.unshift(a);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (dist(head, a) < tolerance) {
          chain.unshift(b);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }
    chains.push(chain);
  }
  return chains;
}

function chaikinSmooth(points: [number, number][], iterations = 2): [number, number][] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const next: [number, number][] = [];
    next.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

function polylineToPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
  }
  return d + ' Z';
}

// Cache to avoid regenerating the same terrain on every render
const cache = new Map<string, { d: string; level: number }[]>();

export function generateTopoContours(opts: {
  width: number;
  height: number;
  seed: number;
  levels?: number;
  resolution?: number;
  color: string;
  strokeWidth?: number;
  opacity?: number;
  elevationRange?: [number, number];
}): { d: string; level: number }[] {
  const {
    width, height, seed,
    levels = 12,
    resolution = 16,
    color,
    strokeWidth = 0.6,
    opacity = 0.5,
    elevationRange = [-0.5, 0.5],
  } = opts;

  const cacheKey = `${width}_${height}_${seed}_${levels}_${resolution}_${elevationRange[0]}_${elevationRange[1]}_${color}_${strokeWidth}_${opacity}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const heightmap = generateHeightmap(width, height, resolution, seed);
  const [eMin, eMax] = elevationRange;
  const paths: { d: string; level: number }[] = [];

  for (let l = 0; l < levels; l++) {
    const elevation = eMin + (l / (levels - 1)) * (eMax - eMin);
    const segments = extractContour(heightmap, resolution, elevation);
    if (segments.length === 0) continue;
    const chains = chainSegments(segments, resolution);
    // Filter out tiny artefacts — at least 3 cells of perimeter
    const filtered = chains.filter(c => c.length >= 6);
    const smoothed = filtered.map(c => chaikinSmooth(c, 2));
    for (const chain of smoothed) {
      const d = polylineToPath(chain);
      if (d) paths.push({ d, level: l });
    }
  }

  cache.set(cacheKey, paths);
  return paths;
}
