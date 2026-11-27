/*
 * Drawing sanity check for the experiment boards. Run: npx tsx scripts/check-boards.ts
 * Flags printed lines (traces, part bodies, op-amp / transistor leads) that run over a
 * socket they are not connected to — on the printed board that looks like a connection
 * that is not there — and two-pin parts whose straight body crosses an IC / transistor.
 */
import { MODULES } from "../src/lab/modules";
import type { ModuleDef, PartDef } from "../src/lab/types";

type P = [number, number];
type Seg = { a: P; b: P; what: string; nodes: Set<string> };

function netOf(m: ModuleDef) {
  const parent = new Map<string, string>();
  const f = (x: string): string => (parent.get(x) ?? x) === x ? x : f(parent.get(x)!);
  const u = (a: string, b: string) => parent.set(f(a), f(b));
  for (const j of m.jacks) parent.set(j.id, j.id);
  for (const tr of m.traces) {
    const ids = tr.filter((p): p is string => typeof p === "string");
    for (let i = 1; i < ids.length; i++) u(ids[0], ids[i]);
  }
  return f;
}

function segments(m: ModuleDef) {
  const jp = new Map(m.jacks.map((j) => [j.id, [j.x, j.y] as P]));
  const net = netOf(m);
  const segs: Seg[] = [];
  const add = (a: P, b: P, what: string, ...ids: string[]) => segs.push({ a, b, what, nodes: new Set(ids.map(net)) });
  for (const tr of m.traces) {
    const pts = tr.map((p) => (typeof p === "string" ? jp.get(p) : p)).filter(Boolean) as P[];
    const ids = tr.filter((p): p is string => typeof p === "string");
    for (let i = 1; i < pts.length; i++) add(pts[i - 1], pts[i], `trace ${ids.join("-")}`, ...ids);
  }
  const symbols: { at: P; r: number; id: string }[] = [];
  for (const p of m.parts) {
    const pins = p.pins.map((id) => (id.startsWith("@") ? null : jp.get(id) ?? null));
    if (p.kind === "OA") {
      const [x, y] = p.at!;
      symbols.push({ at: [x, y], r: 8, id: p.id });
      const [inn, inp, out] = pins;
      if (inn) (add([x - 7, y - 4], [inn[0], y - 4], `${p.id} − lead`, p.pins[0]), add([inn[0], y - 4], inn, `${p.id} − lead`, p.pins[0]));
      if (inp) (add([x - 7, y + 4], [inp[0], y + 4], `${p.id} + lead`, p.pins[1]), add([inp[0], y + 4], inp, `${p.id} + lead`, p.pins[1]));
      if (out) (add([x + 8, y], [out[0], y], `${p.id} out lead`, p.pins[2]), add([out[0], y], out, `${p.id} out lead`, p.pins[2]));
    } else if (p.kind === "NPN" || p.kind === "PNP") {
      const [x, y] = p.at!;
      symbols.push({ at: [x, y], r: 6.2, id: p.id });
      const [c, b, e] = pins;
      if (c) (add([x + 2.6, y - 4.4], [c[0], y - 4.4], `${p.id} C lead`, p.pins[0]), add([c[0], y - 4.4], c, `${p.id} C lead`, p.pins[0]));
      if (b) (add([x - 2.2, y], [b[0], y], `${p.id} B lead`, p.pins[1]), add([b[0], y], b, `${p.id} B lead`, p.pins[1]));
      if (e) (add([x + 2.6, y + 4.4], [e[0], y + 4.4], `${p.id} E lead`, p.pins[2]), add([e[0], y + 4.4], e, `${p.id} E lead`, p.pins[2]));
    } else if (pins[0] && pins[1] && p.kind !== "POT" && !(p.kind === "EXT" && p.ext === "pot")) {
      add(pins[0], pins[1], `${p.id} (${p.kind})`, p.pins[0], p.pins[1]);
    } else if (pins[0] && pins[2]) {
      add(pins[0], pins[2], `${p.id} (${p.kind})`, p.pins[0], p.pins[2]);
    }
  }
  return { segs, symbols, jp, net };
}

function distToSeg(p: P, a: P, b: P) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

let problems = 0;
for (const m of MODULES) {
  if (m.breadboard) continue;
  const { segs, symbols, net } = segments(m);
  const out: string[] = [];
  for (const s of segs) {
    if (Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < 0.5) continue;
    for (const j of m.jacks) {
      if (j.hidden) continue;
      if (s.nodes.has(net(j.id))) continue;
      if (distToSeg([j.x, j.y], s.a, s.b) < 2.0) out.push(`  line over a socket it is not connected to: ${s.what} passes ${j.id} (${j.x},${j.y})`);
    }
    if (!s.what.includes("lead") && !s.what.startsWith("trace"))
      for (const sy of symbols) if (distToSeg(sy.at, s.a, s.b) < sy.r) out.push(`  part body crosses a symbol: ${s.what} over ${sy.id}`);
  }
  console.log(`${m.code}: ${out.length ? out.length + " problem(s)" : "OK"}`);
  for (const l of [...new Set(out)]) console.log(l);
  problems += new Set(out).size;
}
process.exit(problems ? 1 : 0);
