"use client";
/**
 * Vector prints of the bench, made once from the canvas drawings: the KL-21001 panel,
 * every module board, the analog meter scales and the instrument fronts.
 */
import { drawToSvg, svgUrl } from "@/draw/svgctx";
import { drawMeterFace, drawModulePrint, drawTrainerPanel, METER_FACE_PX } from "@/draw/panel";
import { drawDmmFace, drawScopeGlass, DMM_FACE, SCOPE_GLASS } from "@/draw/instruments";
import { TRAINER_H, TRAINER_METERS, TRAINER_W } from "@/lab/trainer";
import { MODULES } from "@/lab/modules";
import type { ModuleDef } from "@/lab/types";
import { useLoad } from "@/ui/loadProgress";

export const panelUrl = () => svgUrl("panel", () => drawToSvg(TRAINER_W, TRAINER_H, drawTrainerPanel));
export const moduleUrl = (m: ModuleDef) => svgUrl(`module-${m.id}`, () => drawToSvg(m.size[0], m.size[1], (c) => drawModulePrint(c, m)));
export const meterUrl = (full: number, unit: string, ac: boolean) =>
  svgUrl(`meter-${full}-${unit}-${ac}`, () => drawToSvg(METER_FACE_PX[0], METER_FACE_PX[1], (c) => drawMeterFace(c, full, unit, ac)));
export const dmmFaceUrl = () => svgUrl("dmm-face", () => drawToSvg(DMM_FACE.w, DMM_FACE.h, drawDmmFace));
export const scopeGlassUrl = () => svgUrl("scope-glass", () => drawToSvg(SCOPE_GLASS.w, SCOPE_GLASS.h, drawScopeGlass));

/** draw every print ahead of time, a little per frame so the progress bar keeps moving */
export async function preparePrints(currentModule: string) {
  const jobs: [string, () => unknown][] = [
    ["KL-21001", panelUrl],
    ...MODULES.map((m) => [m.code, () => moduleUrl(m)] as [string, () => unknown]),
    ...TRAINER_METERS.map((m) => [m.title, () => meterUrl(m.full, m.unit, m.kind.startsWith("ac"))] as [string, () => unknown]),
    ["MT-1232", dmmFaceUrl],
    ["FNIRSI-1013D", scopeGlassUrl],
  ];
  // the board on the bench first
  jobs.sort((a, b) => (b[0] === MODULES.find((m) => m.id === currentModule)?.code ? 1 : 0) - (a[0] === MODULES.find((m) => m.id === currentModule)?.code ? 1 : 0));
  for (let i = 0; i < jobs.length; i++) {
    useLoad.getState().reach("prints", 35 + (55 * i) / jobs.length, jobs[i][0]);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    jobs[i][1]();
  }
  useLoad.getState().reach("prints", 90);
}
