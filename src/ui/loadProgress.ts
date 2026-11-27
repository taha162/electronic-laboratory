"use client";
import { create } from "zustand";

/**
 * Loading progress shown on the start screen. Each stage owns a slice of the bar:
 *  engine  0–32 %  the bench and simulator code arrives
 *  prints 32–90 %  the KL-21001 panel, boards, meter scales and instrument fronts are drawn
 *  frames 90–100 % the bench is on screen
 */
export type LoadStage = "engine" | "prints" | "frames" | "done";
export const STAGES: LoadStage[] = ["engine", "prints", "frames"];

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
