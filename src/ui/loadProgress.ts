"use client";
import { create } from "zustand";

/**
 * Loading progress shown on the start screen. Each stage owns a slice of the bar:
 *  engine  0–30 %  the 3D engine and simulator code arrives
 *  prints 30–62 %  the KL-21001 panel, module and meter faces are drawn
 *  shaders 62–90 % the GPU programs are compiled
 *  frames 90–100 % the first frames are on screen
 */
export type LoadStage = "engine" | "prints" | "shaders" | "frames" | "done";
export const STAGES: LoadStage[] = ["engine", "prints", "shaders", "frames"];

interface LoadState {
  stage: LoadStage;
  pct: number;
  detail: string;
  reach(stage: LoadStage, pct: number, detail?: string): void;
}

export const useLoad = create<LoadState>((set) => ({
  stage: "engine",
  pct: 0,
  detail: "",
  reach: (stage, pct, detail = "") => set((s) => ({ stage, pct: Math.max(s.pct, Math.min(100, pct)), detail })),
}));
