import type { ModuleDef } from "../types";
import { KL23001 } from "./kl23001";
import { KL23002, KL23003, KL25001, BREADBOARD } from "./others";

export const MODULES: ModuleDef[] = [KL23001, KL23002, KL23003, KL25001, BREADBOARD];
export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export function getModule(id: string): ModuleDef {
  return MODULE_BY_ID[id] ?? KL23001;
}
/** knobs that live on modules (trimmers) and their default positions */
export const MODULE_KNOB_DEFAULTS: Record<string, number> = {};
