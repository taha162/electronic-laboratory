"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { create } from "zustand";
import { useBench } from "@/store/bench";
import type { P, Rect } from "./geometry";

/** live pointer position on the bench (world mm) for the cord / lead being carried */
export const usePointer = create<{ p: P | null; set(p: P | null): void }>((set) => ({ p: null, set: (p) => set({ p }) }));

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

/**
 * The bench as a flat drawing you move around: drag to pan, pinch or wheel to zoom,
 * double-tap the bench to zoom in there (or back out). Taps go straight through to the
 * sockets, knobs and instruments; a tap that turned into a drag is swallowed.
 */
export function Viewport({ world, home, children, overlay }: { world: { W: number; H: number }; home: Rect; children: ReactNode; overlay?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const v = useRef<V>({ s: 1, x: 0, y: 0 });
  const anim = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const g = useRef({
    ptrs: new Map<number, { x: number; y: number }>(),
    start: null as null | { x: number; y: number; t: number; v: V },
    pinch: null as null | { d: number; mx: number; my: number; v: V },
    moved: false,
    swallow: false,
    lastTap: { t: 0, x: 0, y: 0 },
  });

  const limits = useCallback(() => {
    const el = box.current;
    const w = el?.clientWidth ?? 1000,
      h = el?.clientHeight ?? 700;
    const fit = Math.min(w / world.W, h / world.H);
    return { min: fit * 0.6, max: Math.max(14, fit * 30) };
  }, [world.W, world.H]);

  const apply = useCallback(() => {
    const el = inner.current;
    if (!el) return;
    const { s, x, y } = v.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    // a moving layer is cached as a bitmap; once it rests let the browser re-draw it sharp
    el.style.willChange = "transform";
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (inner.current) inner.current.style.willChange = "auto";
    }, 180);
  }, []);

  const clampPan = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const w = el.clientWidth,
      h = el.clientHeight;
    const V = v.current;
    const ww = world.W * V.s,
      wh = world.H * V.s;
    const m = 80;
    V.x = ww + 2 * m < w ? (w - ww) / 2 : Math.min(m, Math.max(w - ww - m, V.x));
    V.y = wh + 2 * m < h ? Math.min(Math.max(V.y, m - wh * 0.2), h - wh * 0.8) : Math.min(m + 40, Math.max(h - wh - m, V.y));
  }, [world.W, world.H]);

  const target = useCallback(
    (r: Rect): V => {
      const el = box.current;
      const w = el?.clientWidth ?? 1000,
        h = el?.clientHeight ?? 700;
      const ins = insets();
      const aw = w - ins.left - ins.right,
        ah = h - ins.top - ins.bottom;
      const { min, max } = limits();
      const s = Math.min(max, Math.max(min, Math.min(aw / r.w, ah / r.h)));
      return { s, x: ins.left + (aw - r.w * s) / 2 - r.x * s, y: ins.top + (ah - r.h * s) / 2 - r.y * s };
    },
    [limits],
  );

  const animateTo = useCallback(
    (to: V, ms = 320) => {
      cancelAnimationFrame(anim.current);
      const from = { ...v.current };
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        v.current = { s: from.s + (to.s - from.s) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        apply();
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply],
  );

  const api: ViewApi = {
    frame: (r, animate = true) => {
      const to = target(r);
      if (animate) animateTo(to);
      else {
        v.current = to;
        apply();
      }
    },
    toWorld: (cx, cy) => {
      const el = box.current!;
      const b = el.getBoundingClientRect();
      const { s, x, y } = v.current;
      return [(cx - b.left - x) / s, (cy - b.top - y) / s];
    },
    scale: () => v.current.s,
  };
  const apiRef = useRef(api);
  apiRef.current = api;

  // start on the home view; keep it framed when the window changes shape
  useLayoutEffect(() => {
    v.current = target(home);
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.x, home.y, home.w, home.h, world.W, world.H]);
  useEffect(() => {
    const f = () => apiRef.current.frame(home, false);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [home]);

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number, animate = false) => {
      const el = box.current!;
      const b = el.getBoundingClientRect();
      const px = cx - b.left,
        py = cy - b.top;
      const { min, max } = limits();
      const V = v.current;
      const s = Math.min(max, Math.max(min, V.s * factor));
      const to = { s, x: px - ((px - V.x) / V.s) * s, y: py - ((py - V.y) / V.s) * s };
      if (animate) animateTo(to, 260);
      else {
        v.current = to;
        clampPan();
        apply();
      }
    },
    [limits, apply, animateTo, clampPan],
  );

  // wheel / trackpad: zoom around the cursor (knobs take the wheel themselves)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.("[data-wheel]")) return;
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)));
      else {
        v.current.x -= e.deltaX;
        clampPan();
        apply();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, apply, clampPan]);

  const onPointerDown = (e: React.PointerEvent) => {
    const G = g.current;
    G.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(anim.current);
    if (G.ptrs.size === 1) {
      G.start = { x: e.clientX, y: e.clientY, t: performance.now(), v: { ...v.current } };
      G.moved = false;
      G.pinch = null;
    } else if (G.ptrs.size === 2) {
      const [a, b] = [...G.ptrs.values()];
      G.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...v.current } };
      G.moved = true;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const G = g.current;
    usePointer.getState().set(api.toWorld(e.clientX, e.clientY));
    if (!G.ptrs.has(e.pointerId)) return;
    G.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (G.pinch && G.ptrs.size >= 2) {
      const [a, b] = [...G.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      const P0 = G.pinch;
      const { min, max } = limits();
      const s = Math.min(max, Math.max(min, P0.v.s * (d / P0.d)));
      const el = box.current!.getBoundingClientRect();
      const wx = (P0.mx - el.left - P0.v.x) / P0.v.s,
        wy = (P0.my - el.top - P0.v.y) / P0.v.s;
      v.current = { s, x: mx - el.left - wx * s, y: my - el.top - wy * s };
      apply();
      return;
    }
    const S = G.start;
    if (!S || G.ptrs.size !== 1) return;
    const dx = e.clientX - S.x,
      dy = e.clientY - S.y;
    if (!G.moved && Math.hypot(dx, dy) > 7) {
      G.moved = true;
      try {
        box.current?.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
    }
    if (G.moved) {
      v.current = { ...S.v, x: S.v.x + dx, y: S.v.y + dy };
      clampPan();
      apply();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const G = g.current;
    G.ptrs.delete(e.pointerId);
    if (G.ptrs.size > 0) return;
    if (G.moved) {
      // the click that follows a drag must not plug or toggle anything
      G.swallow = true;
      setTimeout(() => (G.swallow = false), 0);
    } else if (G.start && !(e.target as Element).closest?.("[data-hit]")) {
      // double tap on the bench: zoom in there, or back out when already close
      const now = performance.now();
      const L = G.lastTap;
      if (now - L.t < 320 && Math.hypot(e.clientX - L.x, e.clientY - L.y) < 30) {
        const { max } = limits();
        if (v.current.s > max * 0.35) apiRef.current.frame(home);
        else zoomAt(e.clientX, e.clientY, 2.4, true);
        G.lastTap = { t: 0, x: 0, y: 0 };
      } else G.lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    G.start = null;
    G.pinch = null;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (g.current.swallow) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  // a tap on the bare bench drops whatever is being carried
  const onClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest?.("[data-hit]")) return;
    const s = useBench.getState();
    if (s.pending || s.heldLead || s.selectedWire) s.cancel();
  };

  return (
    <ViewCtx.Provider value={api}>
      <div
        ref={box}
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: "none", background: "radial-gradient(ellipse at 40% 35%, #f1f0ec 0%, #dedcd6 70%, #cfccc5 100%)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => usePointer.getState().set(null)}
        onClickCapture={onClickCapture}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div ref={inner} className="absolute left-0 top-0 origin-top-left" style={{ width: world.W, height: world.H }}>
          {children}
        </div>
        {overlay}
      </div>
    </ViewCtx.Provider>
  );
}
