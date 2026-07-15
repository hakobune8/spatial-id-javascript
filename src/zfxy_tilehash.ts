import { MAX_ZOOM, ZFXYTile, getChildren, getParent, isZFXYTile } from "./zfxy";

export function parseZFXYTilehash(th: string): ZFXYTile | undefined {
  if (!/^-?[1-8]+$/.test(th)) return undefined;

  let negativeF = false;
  if (th[0] === '-') {
    negativeF = true;
    th = th.substring(1);
  }
  if (th.length > MAX_ZOOM) return undefined;
  let children = getChildren();
  let lastChild: ZFXYTile | undefined;
  for (const c of th) {
    const child = children[parseInt(c, 10) - 1];
    if (!child) return undefined;
    lastChild = {...child};
    children = getChildren(lastChild);
  }
  if (!lastChild) return undefined;
  if (negativeF && lastChild.f === 0) return undefined;
  if (negativeF) {
    lastChild.f = -lastChild.f;
  }
  return isZFXYTile(lastChild) ? lastChild : undefined;
}

export function generateTilehash(tile: ZFXYTile): string {
  let {f,x,y,z} = tile;
  const originalF = f;
  let out = '';
  while (z>0) {
    const thisTile: ZFXYTile = { f: Math.abs(f), x: x, y: y, z: z };
    const parent = getParent(thisTile);
    const childrenOfParent = getChildren(parent);
    const positionInParent = childrenOfParent.findIndex(
      (child) => child.f === Math.abs(f) && child.x === x && child.y === y && child.z === z
    );
    out = (positionInParent + 1).toString() + out;
    f = parent.f;
    x = parent.x;
    y = parent.y;
    z = parent.z;
  }
  return (originalF < 0 ? '-' : '') + out;
}
