import { BBox } from "geojson";
import { MAX_ZOOM } from "./zfxy";

const d2r = Math.PI / 180;

export function getBboxZoom(bbox: BBox, sourceZoom: number = MAX_ZOOM) {
  for (let z = sourceZoom; z >= 0; z--) {
    const divisor = 2 ** (sourceZoom - z);
    const minX = Math.floor(bbox[0] / divisor);
    const minY = Math.floor(bbox[1] / divisor);
    const maxX = Math.floor(bbox[2] / divisor);
    const maxY = Math.floor(bbox[3] / divisor);
    if (minX === maxX && minY === maxY) return z;
  }
  return 0;
}

/**
 * Get the smallest tile to cover a bbox
 */
export function bboxToTile(bboxCoords: BBox, minZoom?: number): Array<number> {
  const maxZoom = typeof minZoom !== 'undefined' ? minZoom : MAX_ZOOM;
  const min = pointToTile(bboxCoords[0], bboxCoords[1], maxZoom);
  const max = pointToTile(bboxCoords[2], bboxCoords[3], maxZoom);
  const bbox: BBox = [min[0], min[1], max[0], max[1]];

  const z = getBboxZoom(bbox, maxZoom);
  if (z === 0) return [0, 0, 0];
  const divisor = 2 ** (maxZoom - z);
  const x = Math.floor(bbox[0] / divisor);
  const y = Math.floor(bbox[1] / divisor);
  return [x, y, z];
}

/**
 * Get the tile for a point at a specified zoom level
 */
export function pointToTile(lon: number, lat: number, z: number) {
  var tile = pointToTileFraction(lon, lat, z);
  tile[0] = Math.floor(tile[0]);
  tile[1] = Math.floor(tile[1]);
  return tile;
}

/**
 * Get the precise fractional tile location for a point at a zoom level
 */
function pointToTileFraction(lon: number, lat: number, z: number) {
  var sin = Math.sin(lat * d2r),
      z2 = Math.pow(2, z),
      x = z2 * (lon / 360 + 0.5),
      y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);

  // Wrap Tile X
  x = x % z2;
  if (x < 0) x = x + z2;
  return [x, y, z];
}
