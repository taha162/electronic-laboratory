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
import { KnobSheet } from "./KnobSheet";
import { LoadingScreen } from "./LoadingScreen";
import { useLoad } from "./loadProgress";
import { GeneratorChip } from "./GeneratorChip";
import { Alerts } from "./Alerts";
import { useT } from "./i18n";
import { installAudioUnlock } from "@/audio/audio";

const LabScene = dynamic(() => import("@/three/Scene"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return <LoadingScreen visible />;
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
  const ready = useUi((s) => s.ready);
  const [curtain, setCurtain] = useState(true);
  useEffect(() => {
    if (!ready) return;
    // everything is loaded and drawn: show 100 % for a moment, then open the lab
    useLoad.getState().reach("done", 100);
    const id = setTimeout(() => setCurtain(false), 650);
    return () => clearTimeout(id);
  }, [ready]);
  useEffect(() => {
    installAudioUnlock();
  }, []);
  useEffect(() => {
    setHydrated(true);
    // automation / debugging handle
    const w = window as unknown as { __lab?: Record<string, unknown> };
    w.__lab = { ...(w.__lab ?? {}), bench: useBench, ui: useUi, sim: useSim, applyStep, EXPERIMENTS };
  }, []);
  return (
    <main className="fixed inset-0 select-none">
      <div className="absolute inset-0">{hydrated && <LabScene />}</div>
      {hydrated && (
        <>
          <TopBar />
          <Readings />
          <GeneratorChip />
          <Alerts />
          <Dock />
          <HoverTip />
          <KnobSheet />
          <StatusHint />
          <Toast />
          {panel === "experiment" && <ExperimentPanel />}
          {panel === "scope" && <ScopePanel />}
          {panel === "saves" && <SavesPanel />}
          {panel === "help" && <HelpPanel />}
          {(panel === "parts" || moduleId === "breadboard") && panel !== "experiment" && panel !== "saves" && panel !== "help" && panel !== "scope" && <PartsPanel />}
          {ready && !curtain && <Welcome />}
        </>
      )}
      <LoadingScreen visible={curtain} />
    </main>
  );
}
