import { LngLat, LngLatWithAltitude } from "./types";

export type ZFXYTile = { z: number, f: number, x: number, y: number };

export function isZFXYTile(tile: any): tile is ZFXYTile {
  if (typeof tile !== 'object' || tile === null) return false;

  const {z, f, x, y} = tile;
  if (![z, f, x, y].every(Number.isSafeInteger)) return false;
  if (z < MIN_ZOOM || z > MAX_ZOOM) return false;

  const axisSize = 2 ** z;
  return (
    x >= 0 && x < axisSize &&
    y >= 0 && y < axisSize &&
    f >= -axisSize && f <= axisSize
  );
}

export const ZFXY_1M_ZOOM_BASE = 25 as const;
export const ZFXY_ROOT_TILE: ZFXYTile = { f: 0, x: 0, y: 0, z: 0 };
export const MIN_ZOOM = 0 as const;
export const MAX_ZOOM = 35 as const;
export const MIN_LATITUDE = -85.0511287798 as const;
export const MAX_LATITUDE = 85.0511287798 as const;
export const MIN_LONGITUDE = -180 as const;
export const MAX_LONGITUDE = 180 as const;

const rad2deg = 180 / Math.PI;

export function getParent(tile: ZFXYTile, steps: number = 1): ZFXYTile {
  const { f,x,y,z } = tile;
  if (steps <= 0) {
    throw new Error('steps must be greater than 0');
  }
  if (steps > z) {
    throw new Error(`Getting parent tile of ${tile}, ${steps} steps is not possible because it would go beyond the root tile (z=0)`);
  }
  return {
    f: f >> steps,
    x: x >> steps,
    y: y >> steps,
    z: z -  steps,
  };
}

export function getChildren(tile: ZFXYTile = ZFXY_ROOT_TILE): ZFXYTile[] {
  const {f,x,y,z} = tile;
  return [
    {f: f * 2,     x: x * 2,     y: y * 2,     z: z+1}, // f +0, x +0, y +0
    {f: f * 2,     x: x * 2 + 1, y: y * 2,     z: z+1}, // f +0, x +1, y +0
    {f: f * 2,     x: x * 2,     y: y * 2 + 1, z: z+1}, // f +0, x +0, y +1
    {f: f * 2,     x: x * 2 + 1, y: y * 2 + 1, z: z+1}, // f +0, x +1, y +1
    {f: f * 2 + 1, x: x * 2,     y: y * 2,     z: z+1}, // f +1, x +0, y +0
    {f: f * 2 + 1, x: x * 2 + 1, y: y * 2,     z: z+1}, // f +1, x +1, y +0
    {f: f * 2 + 1, x: x * 2,     y: y * 2 + 1, z: z+1}, // f +1, x +0, y +1
    {f: f * 2 + 1, x: x * 2 + 1, y: y * 2 + 1, z: z+1}, // f +1, x +1, y +1
  ];
}

export function getSurrounding(tile: ZFXYTile = ZFXY_ROOT_TILE): ZFXYTile[] {
  const {f,x,y,z} = tile;
  return [
    zfxyWraparound({f: f, x: x,     y: y,     z: z}), // f +0, x +0, y +0
    zfxyWraparound({f: f, x: x + 1, y: y,     z: z}), // f +0, x +1, y +0
    zfxyWraparound({f: f, x: x,     y: y + 1, z: z}), // f +0, x +0, y +1
    zfxyWraparound({f: f, x: x + 1, y: y + 1, z: z}), // f +0, x +1, y +1
    zfxyWraparound({f: f, x: x - 1, y: y,     z: z}), // f +0, x -1, y +0
    zfxyWraparound({f: f, x: x,     y: y - 1, z: z}), // f +0, x +0, y -1
    zfxyWraparound({f: f, x: x - 1, y: y - 1, z: z}), // f +0, x -1, y -1
    zfxyWraparound({f: f, x: x + 1, y: y - 1, z: z}), // f +0, x +1, y -1
    zfxyWraparound({f: f, x: x - 1, y: y + 1, z: z}), // f +0, x -1, y +1
  ];
}

export function parseZFXYString(str: string): ZFXYTile | undefined {
  const match = str.match(/^\/?(\d+)\/(?:(-?\d+)\/)?(\d+)\/(\d+)$/);
  if (!match) {
    return undefined;
  }
  const tile = {
    z: parseInt(match[1], 10),
    f: parseInt(match[2] || '0', 10),
    x: parseInt(match[3], 10),
    y: parseInt(match[4], 10),
  };
  return isZFXYTile(tile) ? tile : undefined;
}

/** Returns the lng,lat of the northwest corner of the provided tile */
export function getLngLat(tile: ZFXYTile): LngLat {
  const n = Math.PI - 2 * Math.PI * tile.y / Math.pow(2, tile.z);
  return {
    lng: tile.x / Math.pow(2, tile.z) * 360 - 180,
    lat: rad2deg * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
  };
}

export function getCenterLngLat(tile: ZFXYTile): LngLat {
  const x = tile.x * 2 + 1,
        y = tile.y * 2 + 1,
        z = tile.z + 1;
  return getLngLat({x, y, z, f: 0});
}

export function getCenterLngLatAlt(tile: ZFXYTile): LngLatWithAltitude {
  return {
    ...getCenterLngLat(tile),
    alt: getFloor(tile) + ((2**ZFXY_1M_ZOOM_BASE) / (2**(tile.z + 1))),
  };
}

export function getBBox(tile: ZFXYTile): [LngLat, LngLat] {
  const nw = getLngLat(tile),
        se = getLngLat({...tile, y: tile.y + 1, x: tile.x + 1});
  return [ nw, se ];
}

/** Returns the floor of the voxel, in meters */
export function getFloor(tile: ZFXYTile): number {
  return tile.f * (2**ZFXY_1M_ZOOM_BASE) / (2**tile.z)
}

export interface CalculateZFXYInput {
  lat: number
  lng: number
  alt?: number
  zoom: number
}

export function calculateZFXY(input: CalculateZFXYInput): ZFXYTile {
  if (!Number.isFinite(input.lat) || input.lat < MIN_LATITUDE || input.lat > MAX_LATITUDE) {
    throw new Error(`Latitude must be a finite number between ${MIN_LATITUDE} and ${MAX_LATITUDE}.`);
  }
  if (!Number.isFinite(input.lng) || input.lng < MIN_LONGITUDE || input.lng > MAX_LONGITUDE) {
    throw new Error(`Longitude must be a finite number between ${MIN_LONGITUDE} and ${MAX_LONGITUDE}.`);
  }
  if (!Number.isSafeInteger(input.zoom) || input.zoom < MIN_ZOOM || input.zoom > MAX_ZOOM) {
    throw new Error(`Zoom must be an integer between ${MIN_ZOOM} and ${MAX_ZOOM}.`);
  }

  const meters = typeof input.alt !== 'undefined' ? input.alt : 0;
  if (!Number.isFinite(meters)) {
    throw new Error('Altitude must be a finite number.');
  }
  if (meters <= -(2**ZFXY_1M_ZOOM_BASE) || meters >= (2**ZFXY_1M_ZOOM_BASE)) {
    // TODO: make altitude unlimited?
    throw new Error(`ZFXY only supports altitude between -2^${ZFXY_1M_ZOOM_BASE} and +2^${ZFXY_1M_ZOOM_BASE}.`);
  }
  const f = Math.floor(((2 ** input.zoom) * meters) / (2 ** ZFXY_1M_ZOOM_BASE));

  // Algorithm adapted from tilebelt.js
  const d2r = Math.PI / 180;
  const sin = Math.sin(input.lat * d2r);
  const z2 = 2 ** input.zoom;
  let x = z2 * (input.lng / 360 + 0.5);
  const y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);

  // Wrap Tile X
  x = x % z2;
  if (x < 0) x = x + z2;

  return {
    f: f,
    x: Math.floor(x),
    y: Math.floor(y),
    z: input.zoom,
  };
}

/**
 * Fix a tile that has out-of-bounds coordinates by:
 * wrapping the x coordinate around and limiting the y coordinate to the
 * Web Mercator tile range.
 * for the f coordinate: limiting to maximum or minimum.
 */
export function zfxyWraparound(tile: ZFXYTile): ZFXYTile {
  const {z, f, x, y} = tile;
  const axisSize = 2 ** z;
  return {
    z,
    f: Math.max(Math.min(f, axisSize), -axisSize),
    x: ((x % axisSize) + axisSize) % axisSize,
    y: Math.max(0, Math.min(y, axisSize - 1)),
  }
}
