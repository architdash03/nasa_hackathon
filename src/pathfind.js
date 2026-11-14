// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// pathfind.js – find a safe walking path between two points (A* search).
//
// The map is treated as a grid of 100 m cells (the terrain grid). Moving to a
// neighbour cell costs its distance, multiplied by a penalty if the cell is
// steep. Cells steeper than SLOPE_DANGER are "walls" that can't be entered.
// A* always expands the cell with the lowest (cost so far + straight-line
// estimate to the goal), so it finds the cheapest path without searching the
// whole grid.

import { getGrid, SLOPE_CAUTION, SLOPE_DANGER } from './terrain.js';

// Extra cost factor for walking through a cell with this slope
function penalty(slope) {
  if (slope === null) return Infinity;          // no data → don't go there
  if (slope > SLOPE_DANGER) return Infinity;    // too steep → wall
  if (slope > SLOPE_CAUTION) return 4;          // caution zone → strongly avoid
  return 1 + slope / 15;                        // gentle slopes cost a little more
}

// Minimal binary heap (priority queue) of [priority, cellIndex]
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

// lat/lng <-> cell index helpers
function toCell(g, lat, lng) {
  const b = g.bounds;
  const c = Math.floor(((lng - b.west) / (b.east - b.west)) * g.nx);
  const r = Math.floor(((b.north - lat) / (b.north - b.south)) * g.ny);
  if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return -1;
  return r * g.nx + c;
}
function toLatLng(g, idx) {
  const b = g.bounds;
  const r = Math.floor(idx / g.nx), c = idx % g.nx;
  return [b.north - ((r + 0.5) / g.ny) * (b.north - b.south),
          b.west + ((c + 0.5) / g.nx) * (b.east - b.west)];
}

// Returns an array of [lat, lng] from start to end, or null if no safe path.
export function findSafePath(start, end) {
  const g = getGrid();
  const s = toCell(g, start.lat, start.lng);
  const t = toCell(g, end.lat, end.lng);
  if (s < 0 || t < 0) return null;

  const n = g.nx * g.ny;
  const cost = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const tr = Math.floor(t / g.nx), tc = t % g.nx;
  // straight-line distance to the goal in cells (never over-estimates)
  const h = (i) => Math.hypot(Math.floor(i / g.nx) - tr, (i % g.nx) - tc);

  const open = new Heap();
  cost[s] = 0;
  open.push([h(s), s]);

  while (open.size) {
    const [, i] = open.pop();
    if (i === t) break;
    const r = Math.floor(i / g.nx), c = i % g.nx;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= g.ny || cc >= g.nx) continue;
        const j = rr * g.nx + cc;
        // the start/end cells are always allowed (you are already standing there)
        const p = j === t ? 1 : penalty(g.slope[j]);
        if (p === Infinity) continue;
        const step = (dr && dc ? Math.SQRT2 : 1) * p;
        if (cost[i] + step < cost[j]) {
          cost[j] = cost[i] + step;
          from[j] = i;
          open.push([cost[j] + h(j), j]);
        }
      }
    }
  }
  if (from[t] === -1 && s !== t) return null;

  // Walk back from the goal to the start
  const cells = [];
  for (let i = t; i !== -1; i = from[i]) cells.push(i);
  cells.reverse();

  // Keep only the cells where the direction changes (fewer route points)
  const keep = cells.filter((idx, k) => {
    if (k === 0 || k === cells.length - 1) return true;
    const a = cells[k - 1], b = cells[k + 1];
    return idx - a !== b - idx;
  });
  const path = keep.map((i) => toLatLng(g, i));
  path[0] = [start.lat, start.lng];               // start/end exactly where clicked
  path[path.length - 1] = [end.lat, end.lng];
  return path;
}
