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

/** branded loading curtain that fades away once the first frames are rendered */
function LoadingScreen({ visible }: { visible: boolean }) {
  const lang = useBench((s) => s.lang);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-[#15181d] transition-opacity duration-[1400ms]"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-accent)] text-lg font-bold text-black shadow-[0_0_40px_rgba(242,179,61,0.35)]">KL</div>
        <div className="text-base font-semibold">{lang === "ar" ? "مختبر الدوائر الإلكترونية" : "Electronic Circuits Laboratory"}</div>
        <div className="mt-1 text-xs text-[var(--color-mute)]">{lang === "ar" ? "جامعة الموصل · كلية الهندسة" : "University of Mosul · College of Engineering"}</div>
        <div className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[loadbar_1.2s_ease-in-out_infinite] rounded-full bg-[var(--color-accent)]" />
        </div>
        <div className="mt-3 text-[11px] text-[var(--color-mute)]">{lang === "ar" ? "جارٍ تجهيز المختبر…" : "Preparing the laboratory…"}</div>
      </div>
    </div>
  );
}

function PhotoBar() {
  const { t } = useT();
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-40 flex justify-center gap-2">
      <button
        className="glass btn !rounded-full !px-5 !py-2.5"
        onClick={() => {
          const c = document.querySelector("canvas");
          if (!c) return;
          const a = document.createElement("a");
          a.href = (c as HTMLCanvasElement).toDataURL("image/png");
          a.download = `electronics-lab-${Date.now()}.png`;
          a.click();
        }}
      >
        ◉ {t("capturePhoto")}
      </button>
      <button className="glass btn !rounded-full !px-4 !py-2.5" onClick={() => useUi.getState().setPhoto(false)}>
        ✕ {t("exitPhoto")}
      </button>
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
  const ready = useUi((s) => s.ready);
  const photo = useUi((s) => s.photo);
  const [curtain, setCurtain] = useState(true);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setCurtain(false), 250);
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
      {hydrated && !photo && (
        <>
          <TopBar />
          <Readings />
          <GeneratorChip />
          <Alerts />
          <Dock />
          <HoverTip />
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
      {photo && <PhotoBar />}
      <LoadingScreen visible={curtain} />
    </main>
  );
}
