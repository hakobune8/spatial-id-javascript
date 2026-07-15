import { Polygon } from 'geojson';
import { MAX_ALTITUDE, MIN_ALTITUDE, Space, ZFXY_ALTITUDE_LIMIT } from '../src/index';

describe('altitude range exports', () => {
  it('exposes the ZFXY root voxel limits', () => {
    expect(ZFXY_ALTITUDE_LIMIT).toBe(2 ** 25);
    expect(MIN_ALTITUDE).toBe(-(2 ** 25));
    expect(MAX_ALTITUDE).toBe(2 ** 25);
  });
});

describe('Space', () => {
  it('should be able to create a Space from lng/lat/alt', () => {
    const space = new Space({ lng: 0, lat: 0, alt: 10 }, 25);
    expect(space).toBeInstanceOf(Space);
    expect(space.zfxyStr).toStrictEqual('/25/10/16777216/16777216');
    expect(space.tilehash).toStrictEqual('4111111111111111111115151');
  });

  describe('input validation', () => {
    it.each([
      [{lng: 0, lat: 90, alt: 0}, 25, 'Latitude'],
      [{lng: 181, lat: 0, alt: 0}, 25, 'Longitude'],
      [{lng: 0, lat: 0, alt: Number.NaN}, 25, 'Altitude'],
      [{lng: 0, lat: 0, alt: 0}, -1, 'Zoom'],
      [{lng: 0, lat: 0, alt: 0}, 1.5, 'Zoom'],
      [{lng: 0, lat: 0, alt: 0}, 36, 'Zoom'],
    ])('rejects an invalid location %#', (input, zoom, message) => {
      expect(() => new Space(input, zoom)).toThrow(message as string);
    });

    it.each([
      '',
      'abc',
      '9',
      '-9',
      '-1',
      '1'.repeat(36),
      '1/0/2/0',
      '36/0/0/0',
    ])('rejects an invalid encoded string: %s', (input) => {
      expect(() => new Space(input)).toThrow('parse ZFXY failed');
    });

    it.each([
      null,
      {z: 1, f: 0, x: 2, y: 0},
      {z: 1, f: 0, x: 0.5, y: 0},
      {z: 1, f: 3, x: 0, y: 0},
      {z: 36, f: 0, x: 0, y: 0},
    ])('rejects an invalid object %#', (input) => {
      expect(() => new Space(input as any)).toThrow();
    });

    it.each([
      {lng: -180, lat: -85.0511287798, alt: 0},
      {lng: 180, lat: 85.0511287798, alt: 0},
    ])('accepts a documented coordinate boundary: %#', (input) => {
      expect(() => new Space(input, 25)).not.toThrow();
    });
  });

  describe('cardinal direction movement', () => {
    const origin = new Space({lng: 139.747, lat: 35.73, alt: 0}, 20);

    it('moves north toward a higher latitude', () => {
      const north = origin.north();
      expect(north.zfxy.y).toBe(origin.zfxy.y - 1);
      expect(north.center.lat).toBeGreaterThan(origin.center.lat);
    });

    it('moves south toward a lower latitude', () => {
      const south = origin.south();
      expect(south.zfxy.y).toBe(origin.zfxy.y + 1);
      expect(south.center.lat).toBeLessThan(origin.center.lat);
    });

    it('moves by the requested number of cells', () => {
      expect(origin.north(3).zfxy.y).toBe(origin.zfxy.y - 3);
      expect(origin.south(3).zfxy.y).toBe(origin.zfxy.y + 3);
    });

    it('treats a negative distance as movement in the opposite direction', () => {
      expect(origin.north(-2).zfxy).toStrictEqual(origin.south(2).zfxy);
      expect(origin.south(-2).zfxy).toStrictEqual(origin.north(2).zfxy);
    });
  });

  it('works', () => {
    const space = new Space('1/0/0/0');
    expect(space.zfxy).toStrictEqual({z: 1, f: 0, x: 0, y: 0});
    expect(space.zfxyStr).toStrictEqual('/1/0/0/0');
    expect(space.tilehash).toStrictEqual('1');
    expect(space.center).toStrictEqual({
      "alt": 8388608,
      "lat": 66.51326044311186,
      "lng": -90,
    });

    expect(space.up(1).zfxy).toStrictEqual({z: 1, f: 1, x: 0, y: 0});
    expect(space.up(1).tilehash).toStrictEqual('5');
    expect(space.down(1).zfxy).toStrictEqual({z: 1, f: -1, x: 0, y: 0});
    expect(space.down(1).tilehash).toStrictEqual('-5');

    const negativeFSpace = new Space('1/-1/0/0');
    expect(negativeFSpace.zfxy).toStrictEqual({z: 1, f: -1, x: 0, y: 0});
    expect(negativeFSpace.tilehash).toStrictEqual('-5');
  });

  const zfxyToPolygonTruthTable: [string, number[][]][] = [
    ['1/0/0/0', [
      [-180, 85.0511287798066],
      [-180, 0],
      [0, 0],
      [0, 85.0511287798066],
      [-180, 85.0511287798066],
    ]],
    ['25/0/29803304/13212456', [
      [139.75476264953613, 35.68595383239409],
      [139.75476264953613, 35.68594511814803],
      [139.7547733783722, 35.68594511814803],
      [139.7547733783722, 35.68595383239409],
      [139.75476264953613, 35.68595383239409],
    ]],
    ['22/0/3725212/1650923', [
      [139.73751068115234, 35.73014024024556],
      [139.73751068115234, 35.73007056488394],
      [139.73759651184082, 35.73007056488394],
      [139.73759651184082, 35.73014024024556],
      [139.73751068115234, 35.73014024024556],
    ]],
  ];
  for (const [zfxy, polygon] of zfxyToPolygonTruthTable) {
    it(`calculates GeoJSON for ${zfxy}`, () => {
      const space = new Space(zfxy);
      expect(space.toGeoJSON()).toStrictEqual({
        type: 'Polygon',
        coordinates: [
          polygon,
        ]
      });
    });
  }

  describe('parent', () => {
    it('returns the correct parent coordinates with no arguments', () => {
      const space = new Space('25/0/29803304/13212456');
      expect(space.parent().zfxy).toStrictEqual({z: 24, f: 0, x: 14901652, y: 6606228});
    });
    it('returns the correct parent coordinates at a specified zoom level', () => {
      const space = new Space('25/0/29803304/13212456');
      expect(space.parent(23).zfxy).toStrictEqual({z: 23, f: 0, x: 7450826, y: 3303114});
      expect(space.parent(22).zfxy).toStrictEqual({z: 22, f: 0, x: 3725413, y: 1651557});
      expect(space.parent(14).zfxy).toStrictEqual({z: 14, f: 0, x: 14552, y: 6451});
      expect(space.parent(0).zfxy).toStrictEqual({z: 0, f: 0, x: 0, y: 0});
    });

    it.each([30, 31, 32, 35])('preserves safe integers at zoom %i', (z) => {
      const axisSize = 2 ** z;
      const tile = {
        z,
        f: (axisSize / 2) + 1,
        x: axisSize - 1,
        y: (axisSize / 2) + 1,
      };
      const space = new Space(tile);

      expect(space.parent().zfxy).toStrictEqual({
        z: z - 1,
        f: Math.floor(tile.f / 2),
        x: Math.floor(tile.x / 2),
        y: Math.floor(tile.y / 2),
      });
      expect(space.tilehash).toHaveLength(z);
      expect(new Space(space.tilehash).zfxy).toStrictEqual(tile);
    });

    it('rounds a negative f toward its containing parent', () => {
      const tile = {z: 35, f: -17179869185, x: 17179869184, y: 17179869184};
      const space = new Space(tile);

      expect(space.parent().zfxy).toStrictEqual({
        z: 34,
        f: -8589934593,
        x: 8589934592,
        y: 8589934592,
      });
      expect(new Space(space.tilehash).zfxy).toStrictEqual(tile);
    });
  });

  describe('surroundings', () => {
    it('works', () => {
      const space = new Space('25/0/29802274/13208496');
      const zfxyStrs = space.surroundings().map(s => s.zfxyStr);
      expect(zfxyStrs.length).toStrictEqual(26);
      expect(zfxyStrs).toStrictEqual([
        "/25/0/29802275/13208496",
        "/25/0/29802274/13208497",
        "/25/0/29802275/13208497",
        "/25/0/29802273/13208496",
        "/25/0/29802274/13208495",
        "/25/0/29802273/13208495",
        "/25/0/29802275/13208495",
        "/25/0/29802273/13208497",
        "/25/1/29802274/13208496",
        "/25/1/29802275/13208496",
        "/25/1/29802274/13208497",
        "/25/1/29802275/13208497",
        "/25/1/29802273/13208496",
        "/25/1/29802274/13208495",
        "/25/1/29802273/13208495",
        "/25/1/29802275/13208495",
        "/25/1/29802273/13208497",
        "/25/-1/29802274/13208496",
        "/25/-1/29802275/13208496",
        "/25/-1/29802274/13208497",
        "/25/-1/29802275/13208497",
        "/25/-1/29802273/13208496",
        "/25/-1/29802274/13208495",
        "/25/-1/29802273/13208495",
        "/25/-1/29802275/13208495",
        "/25/-1/29802273/13208497",
      ]);
    });

    it('wraps longitude but does not wrap across the north pole', () => {
      const space = new Space('1111111111');
      const surroundings = space.surroundings();
      const zfxyStrs = surroundings.map(s => s.zfxyStr);

      expect(zfxyStrs).toHaveLength(17);
      expect(new Set(zfxyStrs).size).toBe(zfxyStrs.length);
      expect(zfxyStrs).not.toContain(space.zfxyStr);
      expect(surroundings.every(({zfxy}) => zfxy.y === 0 || zfxy.y === 1)).toBe(true);
      expect(zfxyStrs).toContain('/10/0/1023/0');
      expect(zfxyStrs).not.toContain('/10/0/0/1023');
    });

    it('normalizes movement by more than one world width', () => {
      const space = new Space('/3/0/0/4');
      expect(space.move({x: -17}).zfxy.x).toBe(7);
      expect(space.move({x: 25}).zfxy.x).toBe(1);
    });

    it('clamps north/south movement at the Web Mercator limits', () => {
      const north = new Space('/3/0/0/0');
      const south = new Space('/3/0/0/7');
      expect(north.north(10).zfxy.y).toBe(0);
      expect(south.south(10).zfxy.y).toBe(7);
    });
  });

  describe('contains', () => {
    it('works without altitude specified', () => {
      const space = new Space('25/15/29802274/13208496');
      expect(space.contains({
        lat: 35.72044997095608,
        lng: 139.7437134824338,
      })).toBe(true);

      expect(space.contains({
        lat: 35.0,
        lng: 139.0,
      })).toBe(false);
    });

    it('works with altitude specified', () => {
      const space = new Space('25/15/29802274/13208496');
      expect(space.contains({
        lat: 35.72044997095608,
        lng: 139.7437134824338,
        alt: 15.2,
      })).toBe(true);

      expect(space.contains({
        lat: 35.72044997095608,
        lng: 139.7437134824338,
        alt: 0,
      })).toBe(false);

      expect(space.contains({
        lat: 10.0,
        lng: 140.0,
        alt: 0,
      })).toBe(false);

      expect(space.contains({
        lat: 10.0,
        lng: 140.0,
        alt: 15.5,
      })).toBe(false);
    });
  });

  describe('vertices3d', () => {
    it('works', () => {
      const space = new Space('/22/6/3725284/1651062');
      const vertices3d = space.vertices3d();
      expect(vertices3d.length).toStrictEqual(8);
      expect(vertices3d).toStrictEqual([
        [ 139.74369049072266, 35.720454780411565, 48 ],
        [ 139.74369049072266, 35.7203850965781, 48 ],
        [ 139.74377632141113, 35.7203850965781, 48 ],
        [ 139.74377632141113, 35.720454780411565, 48 ],
        [ 139.74369049072266, 35.720454780411565, 56 ],
        [ 139.74369049072266, 35.7203850965781, 56 ],
        [ 139.74377632141113, 35.7203850965781, 56 ],
        [ 139.74377632141113, 35.720454780411565, 56 ],
      ]);
    });
  });
});

const testPolygons: { [key: string]: Polygon } = {
  SIMPLE: {"coordinates":[[[139.7404337636242,35.676005522333085],[139.7404337636242,35.67374730758844],[139.7427432114959,35.67374730758844],[139.7427432114959,35.676005522333085],[139.7404337636242,35.676005522333085]]],"type":"Polygon"},
  DETAILED: {"coordinates":[[[139.73132532824928,35.66657408663923],[139.7308657092451,35.66613900145083],[139.73099702895985,35.66602897953335],[139.73108320752306,35.666103994493525],[139.7309847177366,35.666184010373385],[139.7312986539318,35.666487403189706],[139.7314894778924,35.66635737783834],[139.7310544813364,35.665987304525416],[139.73134174321268,35.665758925093],[139.73141561055252,35.66583560731111],[139.73118169730958,35.66599897352954],[139.73124940903864,35.66605398452789],[139.73146280357656,35.66589061842207],[139.73154487839815,35.665950630499836],[139.73131506889678,35.66610232749561],[139.73142586990656,35.666199013341924],[139.73170287243033,35.66614900343582],[139.7315941232913,35.66622901927059],[139.73171107991362,35.66633403993197],[139.73132532824928,35.66657408663923]]],"type":"Polygon"},
};

function polygonInsideTile(tile: Space): Polygon {
  const ring = tile.toGeoJSON().coordinates[0];
  const [west, north] = ring[0];
  const [east, south] = ring[2];
  const lngInset = (east - west) / 4;
  const latInset = (north - south) / 4;
  return {
    type: 'Polygon',
    coordinates: [[
      [west + lngInset, north - latInset],
      [west + lngInset, south + latInset],
      [east - lngInset, south + latInset],
      [east - lngInset, north - latInset],
      [west + lngInset, north - latInset],
    ]],
  };
}

describe('boundingSpaceForGeometry', () => {
  it('automatically detects the smallest tile that contains the polygon', () => {
    const space = Space.boundingSpaceForGeometry(testPolygons.SIMPLE);
    expect(space.zfxy).toStrictEqual({z: 11, f: 0, x: 1818, y: 806});
  });

  it('respects the minimum zoom level', () => {
    const space = Space.boundingSpaceForGeometry(testPolygons.SIMPLE, 8);
    expect(space.zfxy).toStrictEqual({z: 8, f: 0, x: 227, y: 100});
  });

  it.each([0, 29, 32, 35])('supports an explicit zoom limit of %i', (zoom) => {
    const tile = new Space({lng: 139.747, lat: 35.73, alt: 0}, 35);
    const space = Space.boundingSpaceForGeometry(polygonInsideTile(tile), zoom);
    expect(space.zoom).toBe(zoom);
    if (zoom === 35) expect(space.zfxy).toStrictEqual(tile.zfxy);
  });

  it.each([-1, 1.5, 36])('rejects an invalid zoom limit: %s', (zoom) => {
    expect(() => Space.boundingSpaceForGeometry(testPolygons.SIMPLE, zoom)).toThrow(
      'minZoom must be an integer'
    );
  });
});

describe('spacesForGeometry', () => {
  it('returns the correct spaces for a simple polygon', () => {
    const spaces = Space.spacesForGeometry(testPolygons.SIMPLE, 15);
    expect(spaces.map(s => s.zfxy)).toStrictEqual([
      {z: 15, f: 0, x: 29103, y: 12903},
      {z: 15, f: 0, x: 29103, y: 12904},
    ]);
  });

  it('returns the correct spaces for a detailed polygon', () => {
    const spaces = Space.spacesForGeometry(testPolygons.DETAILED, 20);
    expect(spaces.map(s => s.zfxy)).toStrictEqual([
      { f: 0,    x: 931283,    y: 412959,    z: 20,  },
      { f: 0,    x: 931283,    y: 412960,    z: 20,  },
      { f: 0,    x: 931284,    y: 412958,    z: 20,  },
      { f: 0,    x: 931284,    y: 412959,    z: 20,  },
      { f: 0,    x: 931284,    y: 412960,    z: 20,  },
      { f: 0,    x: 931284,    y: 412961,    z: 20,  },
      { f: 0,    x: 931285,    y: 412958,    z: 20,  },
      { f: 0,    x: 931285,    y: 412959,    z: 20,  },
      { f: 0,    x: 931285,    y: 412960,    z: 20,  },
      { f: 0,    x: 931285,    y: 412961,    z: 20,  },
      { f: 0,    x: 931286,    y: 412959,    z: 20,  },
      { f: 0,    x: 931286,    y: 412960,    z: 20,  },
    ]);
  });

  it('returns the containing tile at zoom 35', () => {
    const tile = new Space({lng: 139.747, lat: 35.73, alt: 0}, 35);
    const spaces = Space.spacesForGeometry(polygonInsideTile(tile), 35);
    expect(spaces.map(({zfxy}) => zfxy)).toStrictEqual([tile.zfxy]);
  });

  it.each([-1, 1.5, 36])('rejects an invalid zoom: %s', (zoom) => {
    expect(() => Space.spacesForGeometry(testPolygons.SIMPLE, zoom)).toThrow(
      'zoom must be an integer'
    );
  });
});
