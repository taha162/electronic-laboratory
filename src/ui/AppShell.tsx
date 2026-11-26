"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useBench } from "@/store/bench";
import { useSimulationDriver, useSim } from "@/lab/simController";
import { useUi } from "@/three/registry";
import { applyStep } from "@/lab/experimentActions";
import { EXPERIMENTS } from "@/lab/experiments";
import { TopBar } from "./TopBar";
import { Dock } from "./Dock";
import { HoverTip, StatusHint, Readings, Toast } from "./Hud";
import { ExperimentPanel } from "./ExperimentPanel";
import { ScopePanel } from "./ScopePanel";
import { SavesPanel } from "./SavesPanel";
import { PartsPanel } from "./PartsPanel";
import { HelpPanel, Welcome } from "./HelpPanel";
import { GeneratorChip } from "./GeneratorChip";

const LabScene = dynamic(() => import("@/three/Scene"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#1a1d22]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-accent)]" />
        <div className="text-sm text-[var(--color-mute)]">KL-21001 · FNIRSI · …</div>
      </div>
    </div>
  );
}

export default function AppShell() {
  useSimulationDriver();
  const lang = useBench((s) => s.lang);
  const panel = useBench((s) => s.panel);
  const moduleId = useBench((s) => s.moduleId);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    setHydrated(true);
    // automation / debugging handle
    const w = window as unknown as { __lab?: Record<string, unknown> };
    w.__lab = { ...(w.__lab ?? {}), bench: useBench, ui: useUi, sim: useSim, applyStep, EXPERIMENTS };
  }, []);
  return (
    <main className="fixed inset-0 select-none">
      <div className="absolute inset-0">{hydrated && <LabScene />}</div>
      <TopBar />
      <Readings />
      <GeneratorChip />
      <Dock />
      <HoverTip />
      <StatusHint />
      <Toast />
      {panel === "experiment" && <ExperimentPanel />}
      {panel === "scope" && <ScopePanel />}
      {panel === "saves" && <SavesPanel />}
      {panel === "help" && <HelpPanel />}
      {(panel === "parts" || moduleId === "breadboard") && panel !== "experiment" && panel !== "saves" && panel !== "help" && panel !== "scope" && <PartsPanel />}
      <Welcome />
    </main>
  );
}
