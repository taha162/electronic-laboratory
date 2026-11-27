"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { useBench } from "@/store/bench";
import type { P, Rect } from "./geometry";

/** live pointer position on the bench (world mm) for the cord / lead being carried */
export const usePointer = create<{ p: P | null; set(p: P | null): void }>((set) => ({ p: null, set: (p) => set({ p }) }));

/** set while two fingers are on the bench, so a knob one of them landed on lets go */
export const gesture = { pinching: false };

export interface ViewApi {
  frame(r: Rect, animate?: boolean): void;
  toWorld(clientX: number, clientY: number): P;
  /** current scale (screen px per mm) */
  scale(): number;
}
const ViewCtx = createContext<ViewApi | null>(null);
export const useView = () => useContext(ViewCtx)!;

/** room taken by the top bar / dock so framed views stay clear of them */
function insets() {
  if (typeof window === "undefined") return { top: 70, bottom: 84, left: 12, right: 12 };
  const w = window.innerWidth,
    h = window.innerHeight;
  const phone = Math.min(w, h) < 520;
  if (phone) return w > h ? { top: 48, bottom: 60, left: 8, right: 8 } : { top: 92, bottom: 118, left: 6, right: 6 };
  // the readings column sits on the right of wide screens
  return { top: 70, bottom: 84, left: 16, right: w >= 768 ? 190 : 16 };
}

interface V {
  s: number;
  x: number;
  y: number;
}
interface Ptr {
  x: number;
  y: number;
  /** went down on a knob: one finger there turns the knob, it doesn't move the bench */
  owned: boolean;
}
type Mode = "idle" | "pan" | "pinch" | "tapzoom" | "owned";
interface PtrEvent {
  pointerId: number;
  clientX: number;
  clientY: number;
  isPrimary: boolean;
  pointerType: string;
  button: number;
  target: EventTarget | null;
}

const SLOP = 7;
const DOUBLE_MS = 320;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** past a limit the bench follows the finger less and less (and springs back on release) */
const rubber = (v: number, lo: number, hi: number) => {
  const k = (d: number) => d / (1 + d / 160);
  return v < lo ? lo - k(lo - v) : v > hi ? hi + k(v - hi) : v;
};
const onHit = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("[data-hit]");

/**
 * Pan / zoom state of the bench. Imperative on purpose: a gesture only writes one CSS
 * transform per frame and never re-renders React.
 */
class ViewCtl {
  box: HTMLDivElement | null = null;
  inner: HTMLDivElement | null = null;
  world = { W: 1, H: 1 };
  home: Rect = { x: 0, y: 0, w: 1, h: 1 };
  /** what is on screen, and the same before the rubber band (gestures work on that) */
  v: V = { s: 1, x: 0, y: 0 };
  raw: V = { s: 1, x: 0, y: 0 };
  raf = 0;
  sharpS = 0;
  sharpT: ReturnType<typeof setTimeout> | undefined;
  wheelT: ReturnType<typeof setTimeout> | undefined;
  lastSize = { w: 0, h: 0 };
  ptrs = new Map<number, Ptr>();
  mode: Mode = "idle";
  base = { x: 0, y: 0, d: 1, v: { s: 1, x: 0, y: 0 } as V };
  moved = false;
  swallow = false;
  lastTap = { t: 0, x: 0, y: 0 };
  track: { t: number; x: number; y: number }[] = [];

  size() {
    return { w: this.box?.clientWidth || 1000, h: this.box?.clientHeight || 700 };
  }
  origin() {
    const b = this.box?.getBoundingClientRect();
    return { left: b?.left ?? 0, top: b?.top ?? 0 };
  }
  /** the part of the screen not covered by the bars */
  area() {
    const { w, h } = this.size();
    const i = insets();
    return { x: i.left, y: i.top, w: Math.max(60, w - i.left - i.right), h: Math.max(60, h - i.top - i.bottom) };
  }
  limits() {
    const { w, h } = this.size();
    const fit = Math.min(w / this.world.W, h / this.world.H);
    return { min: fit * 0.5, max: Math.max(12, fit * 18) };
  }
  /**
   * Where the bench may sit at scale s. A bench smaller than the clear area stays wholly in
   * it; a bigger one may show its edge, at most half the screen in when zoomed well in, so
   * every part of it can be brought to the middle. Continuous in s, so a pinch never jumps.
   */
  bounds(s: number) {
    const a = this.area();
    const axis = (len: number, a0: number, al: number): [number, number] => {
      if (len <= al) return [a0, a0 + al - len];
      const inn = Math.min(al / 2, (len - al) / 2);
      return [a0 + al - len - inn, a0 + inn];
    };
    const [x0, x1] = axis(this.world.W * s, a.x, a.w),
      [y0, y1] = axis(this.world.H * s, a.y, a.h);
    return { x0, x1, y0, y1 };
  }
  rubbered(V: V): V {
    const b = this.bounds(V.s);
    return { s: V.s, x: rubber(V.x, b.x0, b.x1), y: rubber(V.y, b.y0, b.y1) };
  }
  inside(V: V): V {
    const b = this.bounds(V.s);
    return { s: V.s, x: clamp(V.x, b.x0, b.x1), y: clamp(V.y, b.y0, b.y1) };
  }

  set(V: V, raw: V = V) {
    this.v = V;
    this.raw = raw;
    this.apply();
  }
  apply() {
    const el = this.inner;
    if (!el) return;
    const { s, x, y } = this.v;
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    // the layer stays a GPU texture, so moving it costs nothing; once a zoom has settled it
    // is drawn again at the new scale so the print is sharp
    clearTimeout(this.sharpT);
    if (Math.abs(s - this.sharpS) > this.sharpS * 0.01) this.sharpT = setTimeout(() => this.sharpen(), 160);
  }
  sharpen() {
    const el = this.inner;
    if (!el || this.ptrs.size > 1) return;
    this.sharpS = this.v.s;
    el.style.willChange = "auto";
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (this.inner) this.inner.style.willChange = "transform";
      }),
    );
  }

  target(r: Rect): V {
    const a = this.area();
    const { min, max } = this.limits();
    const s = clamp(Math.min(a.w / r.w, a.h / r.h), min, max);
    // centred on r, nudged in only as far as needed to keep the bench's edge within bounds
    return this.inside({ s, x: a.x + (a.w - r.w * s) / 2 - r.x * s, y: a.y + (a.h - r.h * s) / 2 - r.y * s });
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  animateTo(to: V, ms = 320) {
    this.stop();
    const from = { ...this.v };
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      this.set({ s: from.s + (to.s - from.s) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      this.raf = k < 1 ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }
  /** spring back into the bounds after a gesture */
  settle() {
    const to = this.inside(this.v);
    if (Math.abs(to.x - this.v.x) > 0.5 || Math.abs(to.y - this.v.y) > 0.5) this.animateTo(to, 280);
    else this.raw = { ...this.v };
  }
  zoomAt(cx: number, cy: number, f: number, animate: boolean) {
    const { left, top } = this.origin();
    const px = cx - left,
      py = cy - top;
    const { min, max } = this.limits();
    const V = this.v;
    const s = clamp(V.s * f, min, max);
    const to = { s, x: px - ((px - V.x) / V.s) * s, y: py - ((py - V.y) / V.s) * s };
    if (animate) this.animateTo(this.inside(to), 260);
    else this.set(this.inside(to));
  }

  /* ---- fingers / mouse ---- */
  down(e: PtrEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.stop();
    // a new touch sequence: forget any finger whose lift we never heard of
    if (e.isPrimary) {
      this.ptrs.clear();
      gesture.pinching = false;
    }
    const owned = !!(e.target as Element | null)?.closest?.("[data-knob]");
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, owned });
    if (this.ptrs.size === 1) {
      this.moved = false;
      this.track = [];
      const L = this.lastTap;
      const again = performance.now() - L.t < DOUBLE_MS && Math.hypot(e.clientX - L.x, e.clientY - L.y) < 40;
      this.mode = owned ? "owned" : again && !onHit(e.target) ? "tapzoom" : "pan";
      this.base = { x: e.clientX, y: e.clientY, d: 1, v: { ...this.raw } };
    } else if (this.ptrs.size === 2) this.startPinch();
  }
  startPinch() {
    const [a, b] = [...this.ptrs.values()];
    for (const [id, p] of this.ptrs) {
      p.owned = false;
      // the bench takes both fingers: their lift must reach it even if what they first
      // touched is redrawn meanwhile (a meter's display), or a ghost finger stays behind
      try {
        this.box?.setPointerCapture(id);
      } catch {
        /* the pointer may already be gone */
      }
    }
    gesture.pinching = true;
    this.mode = "pinch";
    this.moved = true;
    this.lastTap.t = 0;
    this.base = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, v: { ...this.raw } };
  }
  /** scale about a fixed screen point (base.x, base.y) and put that bench point at (sx, sy) */
  zoomGesture(s: number, sx: number, sy: number) {
    const B = this.base;
    const { left, top } = this.origin();
    const wx = (B.x - left - B.v.x) / B.v.s,
      wy = (B.y - top - B.v.y) / B.v.s;
    const raw = { s, x: sx - left - wx * s, y: sy - top - wy * s };
    this.set(this.rubbered(raw), raw);
  }
  move(e: PtrEvent) {
    const P = this.ptrs.get(e.pointerId);
    if (!P) return;
    P.x = e.clientX;
    P.y = e.clientY;
    const B = this.base;
    const { min, max } = this.limits();
    if (this.mode === "pinch") {
      const [a, b] = [...this.ptrs.values()];
      if (!b) return;
      this.zoomGesture(clamp((B.v.s * Math.hypot(a.x - b.x, a.y - b.y)) / B.d, min, max), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (this.ptrs.size !== 1 || this.mode === "idle") return;
    const dx = e.clientX - B.x,
      dy = e.clientY - B.y;
    if (!this.moved) {
      if (Math.hypot(dx, dy) <= SLOP) return;
      this.moved = true;
      if (this.mode !== "owned")
        try {
          this.box?.setPointerCapture(e.pointerId);
        } catch {
          /* the pointer may already be gone */
        }
    }
    if (this.mode === "owned") return; // a knob is being turned
    if (this.mode === "tapzoom") {
      // double-tap and drag: down zooms in, up zooms out (one-handed zoom)
      this.zoomGesture(clamp(B.v.s * Math.exp(dy * 0.009), min, max), B.x, B.y);
      return;
    }
    const raw = { s: B.v.s, x: B.v.x + dx, y: B.v.y + dy };
    this.set(this.rubbered(raw), raw);
    this.track.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (this.track.length > 10) this.track.shift();
  }
  up(e: PtrEvent, cancelled: boolean) {
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.delete(e.pointerId);
    const n = this.ptrs.size;
    if (n >= 2) return this.startPinch();
    if (n === 1) {
      // a pinch lost a finger: the other one carries on moving the bench from where it is
      if (this.mode === "pinch") {
        const p = [...this.ptrs.values()][0];
        this.mode = "pan";
        this.track = [];
        this.base = { x: p.x, y: p.y, d: 1, v: { ...this.raw } };
      }
      return;
    }
    const mode = this.mode;
    this.mode = "idle";
    gesture.pinching = false;
    if (this.moved) {
      // the click that follows a drag must not plug or toggle anything
      this.swallow = true;
      setTimeout(() => (this.swallow = false), 0);
      this.lastTap.t = 0;
      if (mode === "pan" && !cancelled) this.fling();
      else if (mode !== "owned") this.settle();
      return;
    }
    if (mode === "tapzoom") {
      this.lastTap.t = 0;
      return this.doubleTap(e.clientX, e.clientY);
    }
    this.lastTap = mode === "pan" && !onHit(e.target) ? { t: performance.now(), x: e.clientX, y: e.clientY } : { t: 0, x: 0, y: 0 };
    this.settle();
  }
  /** double tap: closer in two steps, then back to the whole bench */
  doubleTap(cx: number, cy: number) {
    const home = this.target(this.home);
    if (this.v.s > home.s * 3) this.animateTo(home);
    else this.zoomAt(cx, cy, 2.2, true);
  }
  /** a flick keeps the bench gliding, slowing down like a sheet of paper on the table */
  fling() {
    const now = performance.now();
    const pts = this.track.filter((p) => now - p.t < 100);
    const b0 = this.bounds(this.v.s);
    const outside = this.v.x < b0.x0 - 0.5 || this.v.x > b0.x1 + 0.5 || this.v.y < b0.y0 - 0.5 || this.v.y > b0.y1 + 0.5;
    if (pts.length < 2 || outside) return this.settle();
    const a = pts[0],
      z = pts[pts.length - 1];
    const dt = Math.max(16, z.t - a.t);
    let vx = (z.x - a.x) / dt,
      vy = (z.y - a.y) / dt;
    const sp = Math.hypot(vx, vy);
    if (sp < 0.3) return this.settle();
    if (sp > 4) {
      vx *= 4 / sp;
      vy *= 4 / sp;
    }
    let last = now;
    const step = (t: number) => {
      const d = Math.min(40, Math.max(1, t - last));
      last = t;
      const k = Math.pow(0.9965, d);
      vx *= k;
      vy *= k;
      const b = this.bounds(this.v.s);
      let x = this.v.x + vx * d,
        y = this.v.y + vy * d;
      if (x < b.x0 || x > b.x1) {
        x = clamp(x, b.x0, b.x1);
        vx = 0;
      }
      if (y < b.y0 || y > b.y1) {
        y = clamp(y, b.y0, b.y1);
        vy = 0;
      }
      this.set({ s: this.v.s, x, y });
      if (Math.hypot(vx, vy) > 0.03) this.raf = requestAnimationFrame(step);
      else {
        this.raf = 0;
        this.settle();
      }
    };
    this.raf = requestAnimationFrame(step);
  }
  /** wheel zooms about the cursor; a trackpad's two-finger scroll moves, its pinch zooms */
  wheel(e: WheelEvent) {
    if ((e.target as Element | null)?.closest?.("[data-wheel]")) return;
    e.preventDefault();
    this.stop();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * unit,
      dy = e.deltaY * unit;
    const wd = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
    const trackpad = !e.ctrlKey && (e.deltaX !== 0 || (wd ? Math.abs(wd + 3 * e.deltaY) < 2 : e.deltaMode === 0));
    if (trackpad) this.set(this.inside({ s: this.v.s, x: this.v.x - dx, y: this.v.y - dy }));
    else this.zoomAt(e.clientX, e.clientY, clamp(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), 0.7, 1.4), false);
    clearTimeout(this.wheelT);
    this.wheelT = setTimeout(() => this.settle(), 250);
  }
  /** the window changed size: keep what was in the middle of the screen in the middle */
  resize() {
    const { w, h } = this.size();
    const o = this.lastSize;
    this.lastSize = { w, h };
    if (!o.w || (o.w === w && o.h === h)) return;
    const V = this.v;
    const wx = (o.w / 2 - V.x) / V.s,
      wy = (o.h / 2 - V.y) / V.s;
    this.stop();
    this.set(this.inside({ s: V.s, x: w / 2 - wx * V.s, y: h / 2 - wy * V.s }));
  }
}

/**
 * The bench as a flat drawing you move around: drag to pan (flick to glide), pinch or wheel
 * to zoom, double-tap to zoom in there (or back out), double-tap and drag for one-handed zoom.
 * Taps go straight through to the sockets, knobs and instruments; a tap that turned into a
 * drag is swallowed.
 */
export function Viewport({ world, home, children, overlay }: { world: { W: number; H: number }; home: Rect; children: ReactNode; overlay?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [ctl] = useState(() => new ViewCtl());
  ctl.world = world;
  ctl.home = home;
  const [api] = useState<ViewApi>(() => ({
    frame: (r, animate = true) => {
      const to = ctl.target(r);
      if (animate) ctl.animateTo(to);
      else {
        ctl.stop();
        ctl.set(to);
      }
    },
    toWorld: (cx, cy) => {
      const { left, top } = ctl.origin();
      const { s, x, y } = ctl.v;
      return [(cx - left - x) / s, (cy - top - y) / s];
    },
    scale: () => ctl.v.s,
  }));

  // start on the home view (again when the layout turns between portrait and landscape)
  useLayoutEffect(() => {
    ctl.box = box.current;
    ctl.inner = inner.current;
    ctl.lastSize = ctl.size();
    ctl.stop();
    ctl.set(ctl.target(ctl.home));
    ctl.sharpS = ctl.v.s;
  }, [ctl, home.x, home.y, home.w, home.h, world.W, world.H]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => ctl.wheel(e);
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => ctl.resize());
    const forget = () => {
      ctl.ptrs.clear();
      ctl.mode = "idle";
      gesture.pinching = false;
    };
    window.addEventListener("blur", forget);
    ro.observe(el);
    // the page itself never zooms (Safari's pinch / double-tap zoom on the bars): the bench does
    const stop = (e: Event) => e.preventDefault();
    const evs = ["gesturestart", "gesturechange", "gestureend"];
    for (const n of evs) document.addEventListener(n, stop, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
      window.removeEventListener("blur", forget);
      for (const n of evs) document.removeEventListener(n, stop);
      ctl.stop();
    };
  }, [ctl]);

  return (
    <ViewCtx.Provider value={api}>
      <div
        ref={box}
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: "none", background: "radial-gradient(ellipse at 40% 35%, #f1f0ec 0%, #dedcd6 70%, #cfccc5 100%)" }}
        onPointerDown={(e) => ctl.down(e)}
        onPointerMove={(e) => {
          usePointer.getState().set(api.toWorld(e.clientX, e.clientY));
          ctl.move(e);
        }}
        onPointerUp={(e) => ctl.up(e, false)}
        onPointerCancel={(e) => ctl.up(e, true)}
        onPointerLeave={() => usePointer.getState().set(null)}
        onClickCapture={(e) => {
          if (ctl.swallow) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onClick={(e) => {
          // a tap on the bare bench drops whatever is being carried
          if (onHit(e.target)) return;
          const s = useBench.getState();
          if (s.pending || s.heldLead || s.selectedWire) s.cancel();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div ref={inner} className="absolute left-0 top-0 origin-top-left" style={{ width: world.W, height: world.H, willChange: "transform" }}>
          {children}
        </div>
        {overlay}
      </div>
    </ViewCtx.Provider>
  );
}
