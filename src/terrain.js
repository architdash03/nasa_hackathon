// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// terrain.js – elevation + slope lookups from the preprocessed CTX DTM grid,
// and the "steep slope" hazard overlay.
//
// The grid (public/data/jezero_terrain.json) is made by
// scripts/make_terrain_grid.py from the 20 m MRO CTX DTM of Jezero.
// Each cell is 100 m x 100 m and stores:
//   elev  – mean elevation (m, relative to the Mars areoid / "sea level")
//   slope – the steepest 20 m slope inside the cell (degrees)

import L from 'leaflet';

// Hazard thresholds (degrees) – same numbers are used in the route checks
export const SLOPE_CAUTION = 15; // yellow
export const SLOPE_DANGER = 25;  // red

let grid = null; // filled by loadTerrain()

export async function loadTerrain() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/jezero_terrain.json`);
  grid = await res.json();
  return grid;
}

export function getGrid() {
  return grid;
}

export function terrainBounds() {
  const b = grid.bounds;
  return L.latLngBounds([b.south, b.west], [b.north, b.east]);
}

// Convert lat/lon to fractional (column, row) in the grid; row 0 = north edge
function toGrid(lat, lng) {
  const b = grid.bounds;
  const col = ((lng - b.west) / (b.east - b.west)) * grid.nx - 0.5;
  const row = ((b.north - lat) / (b.north - b.south)) * grid.ny - 0.5;
  return { col, row };
}

function cell(arr, col, row) {
  if (col < 0 || row < 0 || col >= grid.nx || row >= grid.ny) return null;
  return arr[row * grid.nx + col];
}

// Elevation (m) at a point, smoothly interpolated between the 4 nearest cells.
// Returns null outside the DTM.
export function elevationAt(lat, lng) {
  if (!grid) return null;
  const { col, row } = toGrid(lat, lng);
  const c0 = Math.floor(col), r0 = Math.floor(row);
  const fx = col - c0, fy = row - r0;
  const v00 = cell(grid.elev, c0, r0), v10 = cell(grid.elev, c0 + 1, r0);
  const v01 = cell(grid.elev, c0, r0 + 1), v11 = cell(grid.elev, c0 + 1, r0 + 1);
  if ([v00, v10, v01, v11].some((v) => v === null)) {
    // near the edge: fall back to the nearest cell
    return cell(grid.elev, Math.round(col), Math.round(row));
  }
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

// Steepest slope (degrees) in the cell that contains the point, or null.
export function slopeAt(lat, lng) {
  if (!grid) return null;
  const { col, row } = toGrid(lat, lng);
  return cell(grid.slope, Math.round(col), Math.round(row));
}

// Build the slope hazard overlay: draw one pixel per grid cell on a canvas
// (transparent / yellow / red), then show the canvas as an image on the map.
export function createSlopeHazardLayer() {
  const canvas = document.createElement('canvas');
  canvas.width = grid.nx;
  canvas.height = grid.ny;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(grid.nx, grid.ny);

  for (let i = 0; i < grid.slope.length; i++) {
    const s = grid.slope[i];
    let rgba = [0, 0, 0, 0]; // safe → fully transparent
    if (s !== null && s > SLOPE_DANGER) rgba = [224, 52, 40, 200];
    else if (s !== null && s > SLOPE_CAUTION) rgba = [240, 200, 40, 150];
    img.data.set(rgba, i * 4);
  }
  ctx.putImageData(img, 0, 0);

  const layer = L.imageOverlay(canvas.toDataURL(), terrainBounds(), {
    opacity: 0.75,
    attribution: 'Slopes computed from MRO CTX Jezero DTM (USGS / NASA Mars 2020)',
    className: 'pixelated', // keep cells crisp instead of blurry
  });
  return layer;
}
