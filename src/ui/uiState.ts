"use client";
import { create } from "zustand";

/** transient UI state that should not be persisted */
interface UiState {
  hover: { id: string; label: string } | null;
  /** knob whose touch-friendly control sheet is open */
  ctrl: string | null;
  /** last requested view of the bench (Dock chips) */
  viewCmd: { name: string; t: number } | null;
  /** first frame drawn */
  ready: boolean;
  /** "X-ray": show node voltages on every connected socket */
  insight: boolean;
  /** highlight the sockets of the next missing connection of the current step */
  guide: boolean;
  setHover(h: UiState["hover"]): void;
  setCtrl(id: string | null): void;
  view(name: string): void;
  setReady(r: boolean): void;
  setInsight(v: boolean): void;
  setGuide(v: boolean): void;
}
export const useUi = create<UiState>((set) => ({
  hover: null,
  ctrl: null,
  viewCmd: null,
  ready: false,
  insight: false,
  guide: true,
  setHover: (hover) => set({ hover }),
  setCtrl: (ctrl) => set({ ctrl }),
  view: (name) => set({ viewCmd: { name, t: Date.now() } }),
  setReady: (ready) => set({ ready }),
  setInsight: (insight) => set({ insight }),
  setGuide: (guide) => set({ guide }),
}));
