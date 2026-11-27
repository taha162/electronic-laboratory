import { createRequire } from "module";
const req = createRequire("/tmp/claude-0/-home-user-electronic-laboratory/41d62541-9cf0-5920-89a2-59190bf5958c/scratchpad/nc/package.json");
const { createCanvas } = req("@napi-rs/canvas");
import { writeFileSync } from "fs";
import { MODULES } from "../src/lab/modules";
import { drawModuleFace } from "../src/three/draw/schematic";
const S = 5;
for (const m of MODULES.filter((x) => x.id === process.argv[2])) {
  const [W, H] = m.size;
  const c = createCanvas(W * S, H * S);
  const ctx = c.getContext("2d");
  ctx.scale(S, S);
  drawModuleFace(ctx as unknown as CanvasRenderingContext2D, m);
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 0.6;
  for (const j of m.jacks) if (!j.hidden) { ctx.beginPath(); ctx.arc(j.x, j.y, 2.2, 0, Math.PI * 2); ctx.stroke(); }
  writeFileSync(`/tmp/claude-0/-home-user-electronic-laboratory/41d62541-9cf0-5920-89a2-59190bf5958c/scratchpad/shots/board_${m.id}.png`, c.toBuffer("image/png"));
}
