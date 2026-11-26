import * as THREE from "three";

/** rounded rectangle outline centred on the origin (metres) */
export function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2,
    y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** a slab w x h x depth (centred, depth along z) with corner radius r and rounded edges */
export function roundedSlab(w: number, h: number, r: number, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * bevel, h - 2 * bevel, Math.max(r - bevel, 0.0004)), {
    depth: Math.max(depth - 2 * bevel, 0.0001),
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 5,
    curveSegments: 14,
  });
  g.translate(0, 0, -Math.max(depth - 2 * bevel, 0.0001) / 2);
  g.computeVertexNormals();
  return g;
}

/** flat rounded rectangle (xy plane) with 0..1 UVs across its bounds */
export function roundedPlane(w: number, h: number, r: number, seg = 12) {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), seg);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

/** a flat rounded-rectangle ring extruded upward (frames, rims, bezels) — sizes in metres */
export function ringGeometry(ow: number, oh: number, iw: number, ih: number, ro: number, ri: number, depth: number, bevel = 0.0008) {
  const outer = roundedRectShape(ow, oh, ro);
  outer.holes.push(new THREE.Path(roundedRectShape(iw, ih, ri).getPoints(24)));
  const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12 });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
