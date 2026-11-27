"use client";
import { useEffect, useMemo, useState } from "react";
import { useBench } from "@/store/bench";
import { getModule } from "@/lab/modules";
import { useUi } from "@/ui/uiState";
import { useLoad } from "@/ui/loadProgress";
import { makeLayout, viewRect } from "./geometry";
import { preparePrints } from "./prints";
import { Viewport, useView } from "./Viewport";
import { Defs, Trainer2D } from "./Trainer2D";
import { Module2D } from "./Module2D";
import { Dmm2D, Scope2D, ScopeScreen } from "./Instruments2D";
import { Cords2D } from "./Cords2D";

function usePortrait() {
  const [p, setP] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.05);
  useEffect(() => {
    const f = () => setP(window.innerHeight > window.innerWidth * 1.05);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return p;
}

/** Dock view chips frame a part of the bench */
function ViewCommands({ L }: { L: ReturnType<typeof makeLayout> }) {
  const api = useView();
  useEffect(
    () =>
      useUi.subscribe((s, p) => {
        if (s.viewCmd && s.viewCmd !== p.viewCmd) api.frame(viewRect(s.viewCmd.name, getModule(useBench.getState().moduleId), L));
      }),
    [api, L],
  );
  return null;
}

function KeyboardShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const s = useBench.getState();
      if (e.key === "Escape") s.cancel();
      if ((e.key === "Delete" || e.key === "Backspace") && s.selectedWire) s.removeWire(s.selectedWire);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return null;
}

/** The lab bench as a flat, zoomable drawing: KL-21001 with its board, the scope, two multimeters. */
export default function Bench2D() {
  const portrait = usePortrait();
  const L = useMemo(() => makeLayout(portrait), [portrait]);
  const moduleId = useBench((s) => s.moduleId);
  const mod = getModule(moduleId);
  const [prints, setPrints] = useState(false);
  useEffect(() => {
    useLoad.getState().reach("prints", 32, "");
    preparePrints(useBench.getState().moduleId).then(() => setPrints(true));
  }, []);
  useEffect(() => {
    if (!prints) return;
    // two frames after the drawing is on screen the lab is ready
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        useLoad.getState().reach("frames", 100);
        useUi.getState().setReady(true);
      }),
    );
  }, [prints]);
  const home = useMemo(() => viewRect("seat", mod, L), [mod, L]);
  if (!prints) return null;
  return (
    <Viewport world={{ W: L.W, H: L.H }} home={home}>
      <svg width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} className="absolute left-0 top-0" style={{ overflow: "visible" }}>
        <Defs />
        <Trainer2D L={L} />
        <Module2D key={mod.id} L={L} mod={mod} />
        <Scope2D L={L} />
        <Dmm2D L={L} which="dmm" label="1" />
        <Dmm2D L={L} which="dmm2" label="2" />
        <Cords2D L={L} mod={mod} />
      </svg>
      <ScopeScreen L={L} />
      <ViewCommands L={L} />
      <KeyboardShortcuts />
    </Viewport>
  );
}
