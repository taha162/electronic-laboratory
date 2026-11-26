"use client";
import { useEffect, useRef, useState } from "react";
import { useBench, SEQ_TDIV, SEQ_VDIV, type ScopeSettings } from "@/store/bench";
import { SCREEN_H, SCREEN_W } from "@/scope/renderScope";
import { autoSet, drawScopeTo, saveScreenshot, saveWaveCsv, screenTouch, useScopeUi } from "@/scope/scopeState";
import { useT } from "./i18n";

function stepSeq(seq: number[], v: number, d: number) {
  let i = seq.findIndex((x) => Math.abs(x - v) < v * 1e-6);
  if (i < 0) i = seq.findIndex((x) => x >= v);
  i = Math.min(Math.max(i + d, 0), seq.length - 1);
  return seq[i];
}
const fmtV = (v: number) => (v >= 1 ? `${v} V` : `${Math.round(v * 1000)} mV`);
const fmtT = (v: number) => (v >= 1e-3 ? `${+(v * 1e3).toFixed(3)} ms` : `${+(v * 1e6).toFixed(3)} µs`);

export function ScopePanel() {
  const { t } = useT();
  const s = useBench((x) => x.scope);
  const set = (fn: (s: ScopeSettings) => ScopeSettings) => useBench.getState().setScope(fn);
  const measure = useScopeUi((x) => x.measure);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const c = canvasRef.current;
      if (c) drawScopeTo(c.getContext("2d")!, performance.now() / 1000);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const ch = (i: 0 | 1, patch: Partial<ScopeSettings["ch"][0]>) =>
    set((x) => {
      const c = [...x.ch] as ScopeSettings["ch"];
      c[i] = { ...c[i], ...patch };
      return { ...x, ch: c };
    });

  return (
    <div
      className="glass pointer-events-auto absolute z-30 w-[min(46rem,calc(100vw-1.5rem))] rounded-2xl"
      style={pos ? { left: pos.x, top: pos.y } : { left: "50%", top: "4.4rem", transform: "translateX(-50%)" }}
      dir="ltr"
    >
      <header
        className="flex cursor-move items-center justify-between border-b border-white/10 px-4 py-2"
        onPointerDown={(e) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => drag.current && setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy })}
        onPointerUp={() => (drag.current = null)}
      >
        <h2 className="text-sm font-semibold">{t("scopeTitle")}</h2>
        <button className="btn !px-2" onClick={() => useBench.getState().setPanel("none")}>
          ✕
        </button>
      </header>
      <div className="p-3">
        <div className="rounded-xl bg-[#e9e9e6] p-2 shadow-inner">
          <div className="rounded-lg bg-black p-1.5">
            <canvas
              ref={canvasRef}
              width={SCREEN_W * 2}
              height={SCREEN_H * 2}
              className="block w-full cursor-pointer rounded"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                screenTouch(((e.clientX - r.left) / r.width) * SCREEN_W, ((e.clientY - r.top) / r.height) * SCREEN_H);
              }}
              onWheel={(e) => set((x) => ({ ...x, tdiv: stepSeq(SEQ_TDIV, x.tdiv, e.deltaY > 0 ? 1 : -1) }))}
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          {([0, 1] as const).map((i) => (
            <div key={i} className="rounded-xl border border-white/10 p-2">
              <div className="mb-2 flex items-center justify-between">
                <button className="btn !py-1 font-bold" style={{ color: i ? "#22c3f0" : "#f7e521" }} data-on={s.ch[i].on} onClick={() => ch(i, { on: !s.ch[i].on })}>
                  CH{i + 1}
                </button>
                <select value={s.ch[i].coupling} onChange={(e) => ch(i, { coupling: e.target.value as "AC" })}>
                  <option>DC</option>
                  <option>AC</option>
                  <option>GND</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[var(--color-mute)]">{t("vdiv")}</span>
                <button className="btn !px-2 !py-1" onClick={() => ch(i, { vdiv: stepSeq(SEQ_VDIV, s.ch[i].vdiv, -1) })}>
                  −
                </button>
                <span className="w-16 text-center font-mono">{fmtV(s.ch[i].vdiv)}</span>
                <button className="btn !px-2 !py-1" onClick={() => ch(i, { vdiv: stepSeq(SEQ_VDIV, s.ch[i].vdiv, 1) })}>
                  +
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2">
                <span className="text-[var(--color-mute)]">{t("position")}</span>
                <input type="range" min={-4} max={4} step={0.1} value={s.ch[i].pos} onChange={(e) => ch(i, { pos: +e.target.value })} className="flex-1 accent-[var(--color-accent)]" />
              </label>
            </div>
          ))}
          <div className="rounded-xl border border-white/10 p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[var(--color-mute)]">{t("tdiv")}</span>
              <button className="btn !px-2 !py-1" onClick={() => set((x) => ({ ...x, tdiv: stepSeq(SEQ_TDIV, x.tdiv, -1) }))}>
                −
              </button>
              <span className="w-16 text-center font-mono">{fmtT(s.tdiv)}</span>
              <button className="btn !px-2 !py-1" onClick={() => set((x) => ({ ...x, tdiv: stepSeq(SEQ_TDIV, x.tdiv, 1) }))}>
                +
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2">
              <span className="text-[var(--color-mute)]">H-pos</span>
              <input type="range" min={-6} max={6} step={0.1} value={s.hpos} onChange={(e) => set((x) => ({ ...x, hpos: +e.target.value }))} className="flex-1 accent-[var(--color-accent)]" />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-[var(--color-mute)]">{t("trigger")}</span>
              <select value={s.trig.src} onChange={(e) => set((x) => ({ ...x, trig: { ...x.trig, src: +e.target.value as 0 | 1 } }))}>
                <option value={0}>CH1</option>
                <option value={1}>CH2</option>
              </select>
              <select value={s.trig.edge} onChange={(e) => set((x) => ({ ...x, trig: { ...x.trig, edge: e.target.value as "rise" } }))}>
                <option value="rise">↑</option>
                <option value="fall">↓</option>
              </select>
              <select value={s.trig.mode} onChange={(e) => set((x) => ({ ...x, run: true, trig: { ...x.trig, mode: e.target.value as "auto" } }))}>
                <option value="auto">Auto</option>
                <option value="normal">Normal</option>
                <option value="single">Single</option>
              </select>
            </div>
            <label className="mt-2 flex items-center gap-2">
              <span className="text-[var(--color-mute)]">{t("level")}</span>
              <input
                type="range"
                min={-4 * s.ch[s.trig.src].vdiv}
                max={4 * s.ch[s.trig.src].vdiv}
                step={s.ch[s.trig.src].vdiv / 25}
                value={s.trig.level}
                onChange={(e) => set((x) => ({ ...x, trig: { ...x.trig, level: +e.target.value } }))}
                className="flex-1 accent-[#21c421]"
              />
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <button className="btn" data-on={!s.run} onClick={() => set((x) => ({ ...x, run: !x.run }))}>
            {s.run ? "■ STOP" : "▶ RUN"}
          </button>
          <button className="btn" onClick={autoSet}>
            {t("autoset")}
          </button>
          <button className="btn" data-on={s.cursors === "t"} onClick={() => set((x) => ({ ...x, cursors: x.cursors === "t" ? "off" : "t" }))}>
            T-{t("cursors")}
          </button>
          <button className="btn" data-on={s.cursors === "v"} onClick={() => set((x) => ({ ...x, cursors: x.cursors === "v" ? "off" : "v" }))}>
            V-{t("cursors")}
          </button>
          <button className="btn" data-on={measure} onClick={() => useScopeUi.getState().toggleMeasure()}>
            {t("measure")}
          </button>
          <button className="btn" onClick={saveScreenshot}>
            {t("savePic")}
          </button>
          <button className="btn" onClick={saveWaveCsv}>
            {t("saveWave")}
          </button>
        </div>
        {s.cursors !== "off" && (
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            {(s.cursors === "t" ? (["t1", "t2"] as const) : (["v1", "v2"] as const)).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <span className="font-mono text-[var(--color-mute)]">{k}</span>
                <input
                  type="range"
                  min={s.cursors === "t" ? -6 : -4}
                  max={s.cursors === "t" ? 6 : 4}
                  step={0.02}
                  value={s.cur[k]}
                  onChange={(e) => set((x) => ({ ...x, cur: { ...x.cur, [k]: +e.target.value } }))}
                  className="flex-1 accent-[#35e035]"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
