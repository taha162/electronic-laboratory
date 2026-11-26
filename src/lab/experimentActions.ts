"use client";
import { useBench, newId, snapshotOf, type ScopeSettings } from "@/store/bench";
import type { LeadId, Wire } from "./types";
import type { StepDef } from "./experiments";
import { buildCircuit } from "./netlist";
import { getModule } from "./modules";
import { TRAINER_JACKS } from "./trainer";

/** Apply a step's reference set-up to the bench ("show me"). */
export function applyStep(module: string, step: StepDef) {
  const s = useBench.getState();
  if (s.moduleId !== module) s.setModule(module);
  const patch: Partial<ReturnType<typeof useBench.getState>> = {};
  if (step.wires) {
    patch.wires = step.wires.map(
      ([a, b, color, kind]): Wire => ({ id: newId("w"), a, b, color: color ?? "red", kind: kind ?? "wire" }),
    );
  }
  if (step.leads) patch.leads = { ...useBench.getState().leads, ...(step.leads as Record<LeadId, string | null>) };
  if (step.knobs) patch.knobs = { ...useBench.getState().knobs, ...step.knobs };
  if (step.dmmMode) patch.dmmMode = step.dmmMode;
  if (step.scope) {
    const sc = useBench.getState().scope;
    const ch = step.scope.ch;
    patch.scope = {
      ...sc,
      tdiv: step.scope.tdiv ?? sc.tdiv,
      ch: ch ? ([{ ...sc.ch[0], ...ch[0] }, { ...sc.ch[1], ...ch[1] }] as ScopeSettings["ch"]) : sc.ch,
      run: true,
    };
  }
  useBench.getState().applySnapshot({ ...patch, power: true });
}

export interface CheckResult {
  ok: boolean;
  missing: string[];
  /** missing connections as socket pairs (lead ids for instrument leads) */
  pairs: [string, string][];
}

function jackLabel(id: string, module: string): string {
  if (id.startsWith("tr:")) {
    const j = TRAINER_JACKS.find((x) => `tr:${x.id}` === id);
    const sec = id.split(":")[1].split(".")[0];
    const names: Record<string, string> = { fg: "Generator", ps: "DC supply", adj: "Adjust power", ac: "AC source", dvm: "DC meter", vr1: "VR1", vr2: "VR2", vr3: "VR3", vr4: "VR4", m1: "DC V meter", m2: "DC mA meter", m3: "AC V meter", m4: "AC mA meter", spk: "Speaker" };
    return `${names[sec] ?? sec} ${j?.label ?? ""}`.trim();
  }
  if (id.startsWith("m:")) {
    const m = getModule(module);
    const local = id.slice(2);
    const j = m.jacks.find((x) => x.id === local);
    const blk = local.split(".")[0];
    return `block ${blk} ${j?.label || local.split(".")[1]}`;
  }
  const leadNames: Record<string, string> = {
    "osc.ch1": "CH1 probe",
    "osc.ch2": "CH2 probe",
    "osc.ch1g": "CH1 ground clip",
    "osc.ch2g": "CH2 ground clip",
    "dmm.v": "multimeter red lead",
    "dmm.com": "multimeter COM lead",
  };
  return leadNames[id] ?? id;
}

/** Electrically compare the bench with the step's reference connections. */
export function checkStep(module: string, step: StepDef): CheckResult {
  const s = useBench.getState();
  if (s.moduleId !== module) return { ok: false, missing: [`module ${getModule(module).code}`], pairs: [] };
  const built = buildCircuit(snapshotOf(s));
  const missing: string[] = [];
  const pairs: [string, string][] = [];
  for (const [a, b] of step.wires ?? []) {
    if (built.nodeOf(a) !== built.nodeOf(b)) {
      missing.push(`${jackLabel(a, module)} ↔ ${jackLabel(b, module)}`);
      pairs.push([a, b]);
    }
  }
  for (const [lead, jack] of Object.entries(step.leads ?? {})) {
    if (!jack) continue;
    if (built.nodeOf(lead) !== built.nodeOf(jack)) {
      missing.push(`${jackLabel(lead, module)} → ${jackLabel(jack, module)}`);
      pairs.push([lead, jack]);
    }
  }
  if (step.dmmMode && s.dmmMode !== step.dmmMode) missing.push(`multimeter function: ${step.dmmMode.toUpperCase()}`);
  return { ok: missing.length === 0, missing, pairs };
}

export { jackLabel };
