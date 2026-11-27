"use client";
import { useBench } from "@/store/bench";
import { getModule } from "@/lab/modules";
import { TRAINER_METERS } from "@/lab/trainer";
import { useLoad } from "@/ui/loadProgress";
import { deskTexture, meterFaceTexture, moduleTexture, trainerPanelTexture } from "./draw/textures";
import { laminateMaps, plasticNormal } from "./draw/pbr";

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Draw the heavy canvas textures one by one before the scene is shown, yielding
 * between them so the loading screen can show which one is being prepared.
 * They are cached, so the scene picks them up instantly afterwards.
 */
export async function preparePrints() {
  const mod = getModule(useBench.getState().moduleId);
  const tasks: [string, () => unknown][] = [
    ["KL-21001", () => trainerPanelTexture()],
    [mod.code, () => moduleTexture(mod)],
    ...TRAINER_METERS.map((m) => [m.title, () => meterFaceTexture(m.full, m.unit, m.kind.startsWith("ac"))] as [string, () => unknown]),
    ["bench", () => (deskTexture(), laminateMaps())],
    ["plastics", () => plasticNormal([2, 2])],
  ];
  for (let i = 0; i < tasks.length; i++) {
    useLoad.getState().reach("prints", 30 + (32 * i) / tasks.length, tasks[i][0]);
    await nextTick();
    tasks[i][1]();
  }
  useLoad.getState().reach("prints", 62);
  await nextTick();
}
