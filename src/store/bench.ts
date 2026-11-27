"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CustomPart, LeadId, PartKind, Wire, WireColor } from "@/lab/types";
import { TRAINER_KNOBS } from "@/lab/trainer";
import { MODULE_KNOB_DEFAULTS, getModule } from "@/lab/modules";

export type Lang = "ar" | "en";
export type DmmMode = "off" | "dcv" | "acv" | "ohm" | "diode" | "dca" | "aca";
export type Coupling = "AC" | "DC" | "GND";

export interface ChannelSettings {
  on: boolean;
  vdiv: number;
  coupling: Coupling;
  /** vertical position, divisions */
  pos: number;
  probe: 1 | 10;
}

export interface ScopeSettings {
  ch: [ChannelSettings, ChannelSettings];
  tdiv: number;
  /** horizontal offset (divisions) */
  hpos: number;
  trig: { src: 0 | 1; level: number; edge: "rise" | "fall"; mode: "auto" | "normal" | "single" };
  run: boolean;
  cursors: "off" | "t" | "v";
  cur: { t1: number; t2: number; v1: number; v2: number };
}

export interface DevicePose {
  x: number;
  z: number;
  rot: number;
}

export interface Snapshot {
  moduleId: string;
  wires: Wire[];
  leads: Record<LeadId, string | null>;
  knobs: Record<string, number>;
  power: boolean;
  scope: ScopeSettings;
  dmmMode: DmmMode;
  customParts: CustomPart[];
  /** burnt-out components (global element ids), behave as open circuits until replaced */
  damaged?: string[];
}

export interface SavedExperiment {
  id: string;
  name: string;
  date: number;
  experimentId: string | null;
  snapshot: Snapshot;
  results: Record<string, string[][]>;
}

export type PanelId = "none" | "scope" | "dmm" | "experiment" | "saves" | "parts" | "help";

export interface Placing {
  kind: PartKind;
  value?: number;
  model?: string;
  color?: string;
  text?: string;
  pins: string[];
}

export const SEQ_VDIV = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
export const SEQ_TDIV = [
  1e-6, 2e-6, 5e-6, 10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3, 100e-3,
];

export const DEFAULT_SCOPE: ScopeSettings = {
  ch: [
    { on: true, vdiv: 5, coupling: "AC", pos: 0, probe: 1 },
    { on: true, vdiv: 5, coupling: "DC", pos: 0, probe: 1 },
  ],
  tdiv: 500e-6,
  hpos: 0,
  trig: { src: 0, level: 0, edge: "rise", mode: "auto" },
  run: true,
  cursors: "off",
  cur: { t1: -2, t2: 2, v1: 1, v2: -1 },
};

/** phones and tablets start in the light renderer; desktops in the full one */
export function defaultQuality(): "high" | "low" {
  if (typeof window === "undefined") return "high";
  const coarse = !!window.matchMedia?.("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  return coarse || small ? "low" : "high";
}

export function defaultKnobs(): Record<string, number> {
  const k: Record<string, number> = {};
  for (const kn of TRAINER_KNOBS) k[kn.id] = kn.def;
  Object.assign(k, MODULE_KNOB_DEFAULTS);
  return k;
}

export const DEFAULT_LEADS: Record<LeadId, string | null> = {
  "osc.ch1": null,
  "osc.ch1g": null,
  "osc.ch2": null,
  "osc.ch2g": null,
  "dmm.v": null,
  "dmm.com": null,
};

export const DEFAULT_DEVICES: Record<"osc" | "dmm", DevicePose> = {
  osc: { x: -0.31, z: 0.27, rot: 0.32 },
  dmm: { x: 0.38, z: 0.3, rot: -0.22 },
};

let uid = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

interface BenchState extends Snapshot {
  lang: Lang;
  wireColor: WireColor;
  pending: string | null; // jack where a new wire starts
  heldLead: LeadId | null;
  selectedWire: string | null;
  devices: Record<"osc" | "dmm", DevicePose>;
  experimentId: string | null;
  step: number;
  results: Record<string, Record<string, string[][]>>;
  saves: SavedExperiment[];
  panel: PanelId;
  placing: Placing | null;
  quality: "high" | "low";
  showHints: boolean;
  toast: { text: string; t: number } | null;
  /** undo / redo history of the wiring (not persisted) */
  past: HistoryEntry[];
  future: HistoryEntry[];
  sound: boolean;

  undo(): void;
  redo(): void;
  damage(id: string): void;
  repairAll(): void;
  setSound(on: boolean): void;
  setLang(l: Lang): void;
  setPanel(p: PanelId): void;
  setWireColor(c: WireColor): void;
  setKnob(id: string, v: number): void;
  setPower(on: boolean): void;
  setModule(id: string): void;
  clickJack(jack: string): void;
  cancel(): void;
  addWire(a: string, b: string, color?: WireColor, kind?: "wire" | "clip"): void;
  removeWire(id: string): void;
  selectWire(id: string | null): void;
  clearWires(): void;
  pickLead(l: LeadId): void;
  attachLead(l: LeadId, jack: string | null): void;
  setScope(fn: (s: ScopeSettings) => ScopeSettings): void;
  setDmmMode(m: DmmMode): void;
  moveDevice(d: "osc" | "dmm", p: Partial<DevicePose>): void;
  setExperiment(id: string | null): void;
  setStep(n: number): void;
  setCell(exp: string, table: string, r: number, c: number, v: string): void;
  startPlacing(p: Omit<Placing, "pins">): void;
  removeCustomPart(id: string): void;
  saveExperiment(name: string): void;
  loadSave(id: string): void;
  deleteSave(id: string): void;
  applySnapshot(s: Partial<Snapshot>): void;
  setQuality(q: "high" | "low"): void;
  setShowHints(v: boolean): void;
  notify(text: string): void;
  resetBench(): void;
}

export interface HistoryEntry {
  wires: Wire[];
  leads: Record<LeadId, string | null>;
  customParts: CustomPart[];
}
const HISTORY_MAX = 120;
function hist(s: { wires: Wire[]; leads: Record<LeadId, string | null>; customParts: CustomPart[]; past: HistoryEntry[] }) {
  const past = [...s.past, { wires: s.wires, leads: s.leads, customParts: s.customParts }];
  if (past.length > HISTORY_MAX) past.shift();
  return { past, future: [] as HistoryEntry[] };
}

const PIN_COUNT: Record<PartKind, number> = {
  R: 2, C: 2, CP: 2, L: 2, D: 2, Z: 2, LED: 2, NPN: 3, PNP: 3, POT: 3, RV: 2, OA: 5,
};

export const useBench = create<BenchState>()(
  persist(
    (set, get) => ({
      moduleId: "kl23001",
      wires: [],
      leads: { ...DEFAULT_LEADS },
      knobs: defaultKnobs(),
      power: true,
      scope: DEFAULT_SCOPE,
      dmmMode: "dcv",
      customParts: [],
      damaged: [],

      lang: "ar",
      wireColor: "red",
      pending: null,
      heldLead: null,
      selectedWire: null,
      devices: DEFAULT_DEVICES,
      experimentId: null,
      step: 0,
      results: {},
      saves: [],
      panel: "none",
      placing: null,
      quality: defaultQuality(),
      showHints: true,
      toast: null,
      past: [],
      future: [],
      sound: true,

      undo: () =>
        set((s) => {
          const prev = s.past[s.past.length - 1];
          if (!prev) return {};
          return {
            ...prev,
            past: s.past.slice(0, -1),
            future: [...s.future, { wires: s.wires, leads: s.leads, customParts: s.customParts }],
            pending: null,
            heldLead: null,
            selectedWire: null,
          };
        }),
      redo: () =>
        set((s) => {
          const nxt = s.future[s.future.length - 1];
          if (!nxt) return {};
          return {
            ...nxt,
            future: s.future.slice(0, -1),
            past: [...s.past, { wires: s.wires, leads: s.leads, customParts: s.customParts }],
            pending: null,
            heldLead: null,
            selectedWire: null,
          };
        }),
      setSound: (sound) => set({ sound }),
      damage: (id) => set((s) => ((s.damaged ?? []).includes(id) ? {} : { damaged: [...(s.damaged ?? []), id] })),
      repairAll: () => set({ damaged: [] }),
      setLang: (lang) => set({ lang }),
      setPanel: (panel) => set({ panel: get().panel === panel ? "none" : panel }),
      setWireColor: (wireColor) => set({ wireColor }),
      setKnob: (id, v) => set((s) => ({ knobs: { ...s.knobs, [id]: v } })),
      setPower: (power) => set({ power }),
      setModule: (id) =>
        set((s) => ({
          moduleId: id,
          wires: s.wires.filter((w) => !w.a.startsWith("m:") && !w.b.startsWith("m:")),
          leads: Object.fromEntries(
            Object.entries(s.leads).map(([k, v]) => [k, v && v.startsWith("m:") ? null : v]),
          ) as Record<LeadId, string | null>,
          customParts: [],
          damaged: [],
          pending: null,
        })),
      clickJack: (jack) => {
        const s = get();
        if (s.placing) {
          const pins = [...s.placing.pins, jack];
          if (pins.length >= PIN_COUNT[s.placing.kind]) {
            const p = s.placing;
            const part: CustomPart = {
              id: newId("U"),
              kind: p.kind,
              value: p.value,
              model: p.model,
              color: p.color,
              text: p.text,
              pins: pins,
              gpins: pins,
              label: p.text,
            };
            set({ ...hist(s), customParts: [...s.customParts, part], placing: { ...p, pins: [] } });
          } else set({ placing: { ...s.placing, pins } });
          return;
        }
        if (s.heldLead) {
          s.attachLead(s.heldLead, jack);
          return;
        }
        if (s.pending === null) {
          set({ pending: jack, selectedWire: null });
          return;
        }
        if (s.pending === jack) {
          set({ pending: null });
          return;
        }
        // neighbouring sockets on a module get a short-circuit clip, like on the real KL boards
        let kind: "wire" | "clip" = "wire";
        if (s.pending.startsWith("m:") && jack.startsWith("m:") && s.moduleId !== "breadboard") {
          const m = getModule(s.moduleId);
          const a = m.jacks.find((j) => `m:${j.id}` === s.pending);
          const b = m.jacks.find((j) => `m:${j.id}` === jack);
          if (a && b && Math.hypot(a.x - b.x, a.y - b.y) <= 34 && (a.x === b.x || a.y === b.y)) kind = "clip";
        }
        s.addWire(s.pending, jack, kind === "clip" ? (s.wireColor === "black" ? "black" : "red") : undefined, kind);
        set({ pending: null });
      },
      cancel: () => {
        const s = get();
        if (s.placing && s.placing.pins.length) set({ placing: { ...s.placing, pins: [] } });
        else set({ pending: null, heldLead: null, selectedWire: null, placing: null });
      },
      addWire: (a, b, color, kind) =>
        set((s) => {
          if (s.wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return {};
          return {
            ...hist(s),
            wires: [...s.wires, { id: newId("w"), a, b, color: color ?? s.wireColor, kind: kind ?? "wire" }],
          };
        }),
      removeWire: (id) => set((s) => ({ ...hist(s), wires: s.wires.filter((w) => w.id !== id), selectedWire: null })),
      selectWire: (id) => set({ selectedWire: id, pending: null }),
      clearWires: () => set((s) => ({ ...hist(s), wires: [], leads: { ...DEFAULT_LEADS }, pending: null, heldLead: null })),
      pickLead: (l) =>
        set((s) => ({
          ...(s.leads[l] ? hist(s) : {}),
          heldLead: s.heldLead === l ? null : l,
          pending: null,
          leads: { ...s.leads, [l]: null },
        })),
      attachLead: (l, jack) =>
        set((s) => ({ ...(s.leads[l] !== jack && jack ? hist(s) : {}), leads: { ...s.leads, [l]: jack }, heldLead: null })),
      setScope: (fn) => set((s) => ({ scope: fn(s.scope) })),
      setDmmMode: (dmmMode) => set({ dmmMode }),
      moveDevice: (d, p) => set((s) => ({ devices: { ...s.devices, [d]: { ...s.devices[d], ...p } } })),
      setExperiment: (experimentId) => set({ experimentId, step: 0 }),
      setStep: (step) => set({ step }),
      setCell: (exp, table, r, c, v) =>
        set((s) => {
          const e = { ...(s.results[exp] ?? {}) };
          const t = (e[table] ?? []).map((row) => row.slice());
          while (t.length <= r) t.push([]);
          t[r][c] = v;
          e[table] = t;
          return { results: { ...s.results, [exp]: e } };
        }),
      startPlacing: (p) => set({ placing: { ...p, pins: [] }, pending: null, heldLead: null }),
      removeCustomPart: (id) => set((s) => ({ ...hist(s), customParts: s.customParts.filter((p) => p.id !== id) })),
      saveExperiment: (name) =>
        set((s) => ({
          saves: [
            {
              id: newId("s"),
              name,
              date: Date.now(),
              experimentId: s.experimentId,
              snapshot: snapshotOf(s),
              results: s.experimentId ? s.results[s.experimentId] ?? {} : {},
            },
            ...s.saves,
          ],
        })),
      loadSave: (id) => {
        const sv = get().saves.find((x) => x.id === id);
        if (!sv) return;
        set((s) => ({
          ...sv.snapshot,
          experimentId: sv.experimentId,
          results: sv.experimentId ? { ...s.results, [sv.experimentId]: sv.results } : s.results,
          pending: null,
          heldLead: null,
        }));
      },
      deleteSave: (id) => set((s) => ({ saves: s.saves.filter((x) => x.id !== id) })),
      applySnapshot: (snap) => set((s) => ({ ...hist(s), ...snap, pending: null, heldLead: null })),
      setQuality: (quality) => set({ quality }),
      setShowHints: (showHints) => set({ showHints }),
      notify: (text) => set({ toast: { text, t: Date.now() } }),
      resetBench: () =>
        set({
          wires: [],
          leads: { ...DEFAULT_LEADS },
          knobs: defaultKnobs(),
          scope: DEFAULT_SCOPE,
          dmmMode: "dcv",
          customParts: [],
          devices: DEFAULT_DEVICES,
          pending: null,
          heldLead: null,
          power: true,
        }),
    }),
    {
      name: "mosul-elab-bench-v2",
      storage: createJSONStorage(() => localStorage),
      // v3: the KL-21001 panel was re-laid out from the photographs (sockets, generator ranges).
      // Keep the student's saved work, results and settings; start the bench wiring fresh.
      // v4: the render quality is chosen per device again (phones start in the light renderer)
      version: 4,
      migrate: (persisted, version) => {
        let p = { ...((persisted ?? {}) as Record<string, unknown>) };
        if (version < 3) {
          const keep: Record<string, unknown> = {};
          for (const k of ["saves", "results", "lang", "showHints", "sound", "experimentId", "step"]) if (p[k] !== undefined) keep[k] = p[k];
          p = keep;
        }
        if (version < 4) delete p.quality;
        // merge() below fills everything else from the defaults
        return p as never;
      },
      partialize: (s) => ({
        moduleId: s.moduleId,
        wires: s.wires,
        leads: s.leads,
        knobs: s.knobs,
        power: s.power,
        scope: s.scope,
        dmmMode: s.dmmMode,
        customParts: s.customParts,
        damaged: s.damaged,
        lang: s.lang,
        devices: s.devices,
        experimentId: s.experimentId,
        step: s.step,
        results: s.results,
        saves: s.saves,
        quality: s.quality,
        showHints: s.showHints,
        sound: s.sound,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BenchState>;
        return {
          ...current,
          ...p,
          knobs: { ...defaultKnobs(), ...(p.knobs ?? {}) },
          leads: { ...DEFAULT_LEADS, ...(p.leads ?? {}) },
        };
      },
    },
  ),
);

export function snapshotOf(s: Snapshot): Snapshot {
  return {
    moduleId: s.moduleId,
    wires: s.wires,
    leads: s.leads,
    knobs: s.knobs,
    power: s.power,
    scope: s.scope,
    dmmMode: s.dmmMode,
    customParts: s.customParts,
    damaged: s.damaged ?? [],
  };
}
