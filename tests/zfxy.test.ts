import * as zfxy from "../src/zfxy";

describe('zfxy', () => {
  describe('calculateZFXY altitude range', () => {
    it.each([
      zfxy.getMinimumAltitude(25) - 0.01,
      zfxy.MAX_ALTITUDE,
      zfxy.MIN_ALTITUDE,
      zfxy.MAX_ALTITUDE + 1,
    ])('rejects altitude outside the ZFXY root voxel: %s', (alt) => {
      expect(() => zfxy.calculateZFXY({lng: 0, lat: 0, alt, zoom: 25})).toThrow(
        'ZFXY root voxel'
      );
    });

    it.each([
      zfxy.getMinimumAltitude(25),
      0,
      zfxy.MAX_ALTITUDE - 1,
    ])('accepts altitude inside the ZFXY root voxel: %s', (alt) => {
      expect(() => zfxy.calculateZFXY({lng: 0, lat: 0, alt, zoom: 25})).not.toThrow();
    });

    it.each([0, 1, 20, 25, 35])('returns an encodable f at zoom %i', (zoom) => {
      const minimum = zfxy.getMinimumAltitude(zoom);
      const voxelHeight = zfxy.ZFXY_ALTITUDE_LIMIT / (2 ** zoom);
      const minTile = zfxy.calculateZFXY({lng: 0, lat: 0, alt: minimum, zoom});
      const maxTile = zfxy.calculateZFXY({
        lng: 0,
        lat: 0,
        alt: zfxy.MAX_ALTITUDE - (voxelHeight / 2),
        zoom,
      });
      const maxIndex = (2 ** zoom) - 1;
      expect(minTile.f).toBe(maxIndex === 0 ? 0 : -maxIndex);
      expect(maxTile.f).toBe(maxIndex);
    });

    it.each([-1, 1.5, 36])('rejects an invalid zoom for minimum altitude: %s', (zoom) => {
      expect(() => zfxy.getMinimumAltitude(zoom)).toThrow('Zoom must be an integer');
    });
  });

  describe('getParent', () => {
    it.each([0, -1, 1.5, Number.NaN])('rejects invalid steps: %s', (steps) => {
      expect(() => zfxy.getParent({z: 2, f: 0, x: 0, y: 0}, steps)).toThrow(
        'steps must be a positive integer'
      );
    });
  });

  describe('getCenterLngLatAlt', () => {
    it('works', () => {
      const center1 = zfxy.getCenterLngLatAlt({z: 25, f: 0, x: 16777216, y: 16777216});
      expect(center1.alt).toStrictEqual(0.5);

      const center2 = zfxy.getCenterLngLatAlt({z: 25, f: 1, x: 16777216, y: 16777216});
      expect(center2.alt).toStrictEqual(1.5);

      const center3 = zfxy.getCenterLngLatAlt({z: 20, f: 0, x: 524288, y: 524288});
      expect(center3.alt).toStrictEqual(16);

      const center4 = zfxy.getCenterLngLatAlt({z: 20, f: 1, x: 524288, y: 524288});
      expect(center4.alt).toStrictEqual(32 + 16);

      const center5 = zfxy.getCenterLngLatAlt({z: 20, f: 10, x: 524288, y: 524288});
      expect(center5.alt).toStrictEqual((32 * 10) + 16);
    });
  });
});
