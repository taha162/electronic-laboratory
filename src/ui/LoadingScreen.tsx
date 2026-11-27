"use client";
import { useEffect, useRef, useState } from "react";
import { useBench } from "@/store/bench";
import { STAGES, useLoad, type LoadStage } from "./loadProgress";
import { Icon } from "./icons";

const STAGE_TEXT: Record<LoadStage, { ar: string; en: string }> = {
  engine: { ar: "تحميل محرك العرض والمحاكاة", en: "Loading the 3D engine and simulator" },
  prints: { ar: "رسم لوحات الأجهزة", en: "Drawing the instrument panels" },
  shaders: { ar: "تجهيز الرسوميات", en: "Preparing the graphics" },
  frames: { ar: "تشغيل المختبر", en: "Starting the lab" },
  done: { ar: "جاهز", en: "Ready" },
};

const TIPS: { ar: string; en: string }[] = [
  { ar: "كل قراءة على الأجهزة تأتي من محاكاة حقيقية للدائرة التي توصلها، لا من موجات مسجلة.", en: "Every reading comes from a real simulation of the circuit you wire — nothing is pre-recorded." },
  { ar: "انقر مقبسين لتوصيل سلك بينهما، وانقر مرتين على أي جزء للاقتراب منه.", en: "Tap two sockets to connect them; double-tap any part to zoom in on it." },
  { ar: "انقر أي مقبض لتظهر لوحة تحكم كبيرة تعرض القيمة الفعلية.", en: "Tap a knob to get a large control showing the real value." },
  { ar: "المقاومات المتغيرة VR1–VR4 في جهاز KL-21001 توصل إلى اللوحات بأسلاك كما في المختبر.", en: "VR1–VR4 of the KL-21001 are patched into the boards with cords, as in the lab." },
  { ar: "الأحمال الزائدة حقيقية: المصدر يحدّ التيار والقطع تسخن وقد تحترق.", en: "Overloads are real: supplies limit their current and parts heat up and can burn." },
  { ar: "زر أرشدني يضيء المقابس التي تحتاج توصيلها في الخطوة الحالية.", en: "“Guide me” lights up the sockets the current step still needs." },
];

/** start screen: real progress through the loading stages, a scope trace that draws with it, and tips */
export function LoadingScreen({ visible }: { visible: boolean }) {
  const lang = useBench((s) => s.lang);
  const target = useLoad((s) => s.pct);
  const stage = useLoad((s) => s.stage);
  const detail = useLoad((s) => s.detail);
  const [shown, setShown] = useState(0);
  const [tip, setTip] = useState(0);
  const t0 = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  // smooth the bar; while the engine code downloads, creep towards 28 %
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = useLoad.getState();
      const goal = s.stage === "engine" && s.pct < 30 ? 28 * (1 - Math.exp(-(performance.now() - t0.current) / 2600)) : s.pct;
      setShown((v) => (Math.abs(goal - v) < 0.05 ? goal : v + (goal - v) * 0.12));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3800);
    return () => clearInterval(id);
  }, []);
  void target;
  const pct = Math.round(shown);
  const L = lang === "ar" ? "ar" : "en";
  // the trace: a sine drawn across the scope screen up to the current progress
  const W = 240,
    H = 96;
  let d = "";
  const n = Math.max(2, Math.round((shown / 100) * 120));
  for (let i = 0; i <= n; i++) {
    const x = (i / 120) * W;
    const y = H / 2 - Math.sin((i / 120) * Math.PI * 6) * (H * 0.32);
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  const idx = STAGES.indexOf(stage === "done" ? "frames" : stage);
  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-[radial-gradient(ellipse_at_center,#20252d_0%,#12151a_70%)] transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
      dir={L === "ar" ? "rtl" : "ltr"}
    >
      <div className="w-[min(92vw,26rem)] text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-accent)] text-lg font-bold text-black shadow-[0_0_40px_rgba(242,179,61,0.35)]">KL</div>
        <div className="text-base font-semibold">{L === "ar" ? "مختبر الدوائر الإلكترونية" : "Electronic Circuits Laboratory"}</div>
        <div className="mt-1 text-xs text-[var(--color-mute)]">{L === "ar" ? "جامعة الموصل · كلية الهندسة" : "University of Mosul · College of Engineering"}</div>

        {/* oscilloscope screen whose trace grows with the progress */}
        <div className="mx-auto mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#05070c] p-2 shadow-inner" dir="ltr">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`v${i}`} x1={(i * W) / 12} x2={(i * W) / 12} y1={0} y2={H} stroke="rgba(160,165,180,0.16)" strokeDasharray="1 3" />
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <line key={`h${i}`} x1={0} x2={W} y1={(i * H) / 6} y2={(i * H) / 6} stroke="rgba(160,165,180,0.16)" strokeDasharray="1 3" />
            ))}
            <path d={d} fill="none" stroke="#f7e521" strokeWidth="2" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(247,229,33,0.7))" }} />
            <text x={W - 6} y={14} textAnchor="end" fill="#f7e521" fontSize="12" fontFamily="monospace">
              {pct}%
            </text>
          </svg>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{STAGE_TEXT[stage][L]}</span>
          <span className="font-mono text-2xl font-bold text-[var(--color-accent)]" dir="ltr">
            {pct}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" dir="ltr">
          <div className="h-full rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_rgba(242,179,61,0.6)]" style={{ width: `${shown}%` }} />
        </div>
        <div className="mt-1 h-4 text-start font-mono text-[11px] text-[var(--color-mute)]" dir="ltr">
          {detail}
        </div>

        {/* stage checklist */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-[11px]">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 ${i < idx || stage === "done" ? "border-[var(--color-accent)]/40 text-[var(--color-accent)]" : i === idx ? "border-white/25 text-white" : "border-white/10 text-[var(--color-mute)]"}`}
            >
              <Icon name={i < idx || stage === "done" ? "check" : i === idx ? "knob" : "more"} size={15} />
              <span className="leading-tight">{STAGE_TEXT[s][L]}</span>
            </div>
          ))}
        </div>

        {/* tips while waiting */}
        <div className="mt-5 min-h-[3.2rem] rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12.5px] leading-relaxed text-[#d9dde6]">
          <span className="me-1 font-semibold text-[var(--color-accent)]">{L === "ar" ? "هل تعلم؟" : "Did you know?"}</span>
          {TIPS[tip][L]}
        </div>
      </div>
    </div>
  );
}
