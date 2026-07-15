import { LngLatWithAltitude } from "./types";
import { calculateZFXY, getBBox, getChildren, getFloor, getParent, isZFXYTile, parseZFXYString, ZFXYTile, zfxyWraparound, getSurrounding, getCenterLngLatAlt, MAX_ZOOM, MIN_ZOOM } from "./zfxy";
import { generateTilehash, parseZFXYTilehash } from "./zfxy_tilehash";
import turfBBox from '@turf/bbox';
import turfBooleanIntersects from '@turf/boolean-intersects';
import type { Geometry, Polygon } from "geojson";
import { bboxToTile, pointToTile } from "./tilebelt";

export { MIN_ALTITUDE, MAX_ALTITUDE, ZFXY_ALTITUDE_LIMIT, getMinimumAltitude } from "./zfxy";

const DEFAULT_ZOOM = 25 as const;

function geometryPositions(geom: Geometry): number[][] {
  if (geom.type === 'GeometryCollection') {
    throw new Error('GeometryCollection is not supported.');
  }

  const positions: number[][] = [];
  const visit = (value: any): void => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      positions.push(value);
      return;
    }
    for (const child of value) visit(child);
  };
  visit((geom as any).coordinates);

  if (positions.length === 0) throw new Error('Geometry must contain coordinates.');
  const dimensions = new Set(positions.map((position) => position.length >= 3 ? 3 : 2));
  if (dimensions.size > 1) {
    throw new Error('Geometry cannot mix 2D and 3D positions.');
  }
  for (const position of positions) {
    if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
      throw new Error('Geometry longitude and latitude must be finite numbers.');
    }
    if (dimensions.has(3) && !Number.isFinite(position[2])) {
      throw new Error('Geometry altitude must be a finite number.');
    }
  }
  return positions;
}

function common3dSpace(positions: number[][], maxZoom: number): Space {
  const tiles = positions.map(([lng, lat, alt]) => calculateZFXY({lng, lat, alt, zoom: maxZoom}));
  for (let z = maxZoom; z >= MIN_ZOOM; z--) {
    const divisor = 2 ** (maxZoom - z);
    const candidate: ZFXYTile = {
      z,
      f: Math.floor(tiles[0].f / divisor),
      x: Math.floor(tiles[0].x / divisor),
      y: Math.floor(tiles[0].y / divisor),
    };
    const containsAll = tiles.every((tile) => (
      Math.floor(tile.f / divisor) === candidate.f &&
      Math.floor(tile.x / divisor) === candidate.x &&
      Math.floor(tile.y / divisor) === candidate.y
    ));
    if (containsAll) return new Space(candidate);
  }
  throw new Error('A 3D geometry spanning separate altitude roots cannot be represented by one Space.');
}

export class Space {
  center: LngLatWithAltitude
  alt: number
  zoom: number

  zfxy: ZFXYTile

  id: string
  zfxyStr: string
  tilehash: string

  /**
   * Create a new Space
   *
   * @param input A LngLatWithAltitude or string containing either a ZFXY or tilehash-encoded ZFXY.
   * @param zoom Optional. Defaults to 25 when `input` is LngLatWithAltitude. Ignored when ZXFY or tilehash is provided.
   */
  constructor(input: LngLatWithAltitude | ZFXYTile | string, zoom?: number) {
    if (typeof input === 'string') {
      // parse string
      let zfxy = parseZFXYString(input) || parseZFXYTilehash(input);
      if (zfxy) {
        this.zfxy = zfxy;
        this._regenerateAttributesFromZFXY();
      } else {
        throw new Error(`parse ZFXY failed with input: ${input}`);
      }
      return;
    } else if (isZFXYTile(input)) {
      this.zfxy = input;
      this._regenerateAttributesFromZFXY();
      return;
    } else {
      if (
        typeof input !== 'object' || input === null ||
        !('lng' in input) || !('lat' in input)
      ) {
        throw new Error('Input must be a valid lng/lat location, ZFXY tile, or encoded string.');
      }
      this.zfxy = calculateZFXY({
        ...input,
        zoom: (typeof zoom !== 'undefined') ? zoom : DEFAULT_ZOOM,
      });
    }

    this._regenerateAttributesFromZFXY();
  }

  /* - PUBLIC API - */

  /** Moves upward, clamping at the highest tilehash-encodable f index. */
  up(by: number = 1) {
    return this.move({f: by});
  }

  /** Moves downward, clamping at the lowest tilehash-encodable f index. */
  down(by: number = 1) {
    return this.move({f: -by});
  }

  north(by: number = 1) {
    return this.move({y: -by});
  }

  south(by: number = 1) {
    return this.move({y: by});
  }

  east(by: number = 1) {
    return this.move({x: by});
  }

  west(by: number = 1) {
    return this.move({x: -by});
  }

  move(by: Partial<Omit<ZFXYTile, 'z'>>) {
    const newSpace = new Space(this.zfxy);
    newSpace.zfxy = zfxyWraparound({
      z: newSpace.zfxy.z,
      f: newSpace.zfxy.f + (by.f || 0),
      x: newSpace.zfxy.x + (by.x || 0),
      y: newSpace.zfxy.y + (by.y || 0),
    });
    newSpace._regenerateAttributesFromZFXY();
    return newSpace;
  }

  parent(atZoom?: number) {
    const steps = (typeof atZoom === 'undefined') ? 1 : this.zfxy.z - atZoom;
    return new Space(getParent(this.zfxy, steps));
  }

  children() {
    return getChildren(this.zfxy).map((tile) => new Space(tile));
  }

  /** Return an array of Space objects at the same zoom level that surround this Space
   * object. This method does not return the Space object itself or duplicates. The
   * array normally contains 26 objects and contains fewer at latitude/altitude limits.
   */
  surroundings(): Space[] {
    const surroundingTiles = [
      ...getSurrounding(this.zfxy),
      ...getSurrounding(this.up().zfxy),
      ...getSurrounding(this.down().zfxy),
    ];
    const uniqueTiles = new Map<string, ZFXYTile>();

    for (const tile of surroundingTiles) {
      const key = `/${tile.z}/${tile.f}/${tile.x}/${tile.y}`;
      if (key !== this.zfxyStr) uniqueTiles.set(key, tile);
    }

    return [...uniqueTiles.values()].map((tile) => new Space(tile));
  }

  /** Returns true if a point lies within this Space. If the position's altitude is not
   * specified, it is ignored from the calculation.
   */
  contains(position: LngLatWithAltitude) {
    const geom = this.toGeoJSON();
    const point = {
      type: 'Point',
      coordinates: [position.lng, position.lat],
    };
    const floor = this.alt;
    const ceil = getFloor({...this.zfxy, f: this.zfxy.f + 1});
    return (
      turfBooleanIntersects(geom, point) &&
      (typeof position.alt !== 'undefined' === true ?
        position.alt >= floor && position.alt < ceil
        :
        true
      )
    );
  }

  /** Calculates the polygon of this Space and returns a 2D GeoJSON Polygon. */
  toGeoJSON(): Polygon {
    const [nw, se] = getBBox(this.zfxy);
    return {
      type: 'Polygon',
      coordinates: [
        [
          [nw.lng, nw.lat],
          [nw.lng, se.lat],
          [se.lng, se.lat],
          [se.lng, nw.lat],
          [nw.lng, nw.lat],
        ],
      ],
    };
  }

  /** Calculates the 3D polygon of this Space and returns the vertices of that polygon. */
  vertices3d(): [number, number, number][] {
    const [nw, se] = getBBox(this.zfxy);
    const floor = getFloor(this.zfxy);
    const ceil = getFloor({...this.zfxy, f: this.zfxy.f + 1});
    return [
      [nw.lng, nw.lat, floor],
      [nw.lng, se.lat, floor],
      [se.lng, se.lat, floor],
      [se.lng, nw.lat, floor],
      [nw.lng, nw.lat, ceil],
      [nw.lng, se.lat, ceil],
      [se.lng, se.lat, ceil],
      [se.lng, nw.lat, ceil],
    ];
  }

  static getSpaceById(id: string, zoom?: number) {
    return new Space(id, zoom);
  }

  static getSpaceByLocation(loc: LngLatWithAltitude, zoom?: number) {
    return new Space(loc, zoom);
  }

  static getSpaceByZFXY(zfxyStr: string) {
    return new Space(zfxyStr);
  }

  /** Calculates the smallest spatial ID to fully contain the geometry.
   * For 3D coordinates, the third value is treated as altitude in meters.
   * `minZoom` is retained for API compatibility and specifies the maximum zoom
   * level to inspect (a lower value forces a coarser result).
   */
  static boundingSpaceForGeometry(geom: Geometry, minZoom?: number): Space {
    minZoom = minZoom ?? DEFAULT_ZOOM;
    if (!Number.isSafeInteger(minZoom) || minZoom < MIN_ZOOM || minZoom > MAX_ZOOM) {
      throw new Error(`minZoom must be an integer between ${MIN_ZOOM} and ${MAX_ZOOM}.`);
    }
    const positions = geometryPositions(geom);
    if (positions[0].length >= 3) return common3dSpace(positions, minZoom);

    const bbox = turfBBox(geom);
    const largestTile = bboxToTile(bbox, minZoom);
    const [ x, y, z ] = largestTile;
    return new Space({x, y, z, f: 0});
  }

  /** Calculates the spaces intersecting a geometry. For 3D coordinates, every
   * vertical voxel between the minimum and maximum vertex altitude is returned.
   */
  static spacesForGeometry(geom: Geometry, zoom: number): Space[] {
    const z = zoom;

    if (!Number.isSafeInteger(z) || z < MIN_ZOOM || z > MAX_ZOOM) {
      throw new Error(`zoom must be an integer between ${MIN_ZOOM} and ${MAX_ZOOM}.`);
    }

    const positions = geometryPositions(geom);
    const is3d = positions[0].length >= 3;
    let minAltitude = 0;
    let maxAltitude = 0;
    if (is3d) {
      minAltitude = positions[0][2];
      maxAltitude = positions[0][2];
      for (const position of positions) {
        minAltitude = Math.min(minAltitude, position[2]);
        maxAltitude = Math.max(maxAltitude, position[2]);
      }
    }
    const [lng, lat] = positions[0];
    const minF = calculateZFXY({lng, lat, alt: minAltitude, zoom: z}).f;
    const maxF = calculateZFXY({lng, lat, alt: maxAltitude, zoom: z}).f;

    if (z === 0) return [new Space({z: 0, f: 0, x: 0, y: 0})];

    // this can be optimized a lot!
    const bbox = turfBBox(geom),
          min = pointToTile(bbox[0], bbox[1], z),
          max = pointToTile(bbox[2], bbox[3], z),
          minX = Math.min(min[0], max[0]),
          minY = Math.min(min[1], max[1]),
          maxX = Math.max(max[0], min[0]),
          maxY = Math.max(max[1], min[1]),
          spaces: Space[] = [];

    // scanline polygon fill algorithm
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const footprint = new Space({x, y, z, f: 0});
        // geometryPositions rejects GeometryCollection above, but GeoJSON's
        // Geometry union is not narrowed across that helper call.
        if (turfBooleanIntersects(geom as Exclude<Geometry, {type: 'GeometryCollection'}>, footprint.toGeoJSON())) {
          for (let f = minF; f <= maxF; f++) {
            spaces.push(new Space({x, y, z, f}));
          }
        }
      }
    }
    return spaces;
  }

  private _regenerateAttributesFromZFXY() {
    this.alt = getFloor(this.zfxy);
    this.center = getCenterLngLatAlt(this.zfxy);
    this.zoom = this.zfxy.z;
    this.id = this.tilehash = generateTilehash(this.zfxy);
    this.zfxyStr = `/${this.zfxy.z}/${this.zfxy.f}/${this.zfxy.x}/${this.zfxy.y}`;
  }
}
