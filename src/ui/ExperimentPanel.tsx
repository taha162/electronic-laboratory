"use client";
import { Icon } from "./icons";
import { useMemo, useState } from "react";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { EXPERIMENTS, EXPERIMENT_BY_ID, type TableDef } from "@/lab/experiments";
import { applyStep, checkStep, type CheckResult } from "@/lab/experimentActions";
import { getModule } from "@/lab/modules";
import { useT } from "./i18n";
import { useUi } from "./uiState";

function Panel({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <aside className="glass pointer-events-auto absolute end-3 top-[4.4rem] bottom-[5.2rem] z-20 flex w-[min(30rem,calc(100vw-1.5rem))] flex-col rounded-2xl">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button className="btn !px-2" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">{children}</div>
    </aside>
  );
}
export { Panel };

/** live readings that can be dropped into a table cell */
function useReadingChips() {
  const r = useSim((s) => s.readings);
  const ch = useSim((s) => s.ch);
  const dmmMode = useBench((s) => s.dmmMode);
  const f = (x: number, d = 3) => (Number.isFinite(x) ? (+x.toFixed(d)).toString() : "");
  const chips: { k: string; v: string }[] = [];
  if (dmmMode !== "off" && r.dmm.value !== null) chips.push({ k: `DMM ${r.dmm.unit}`, v: r.dmm.text });
  chips.push({ k: "DC meter V", v: f(r.dvm.v, 2) });
  chips.push({ k: "mA meter", v: f(r.meters.m2, 2) });
  ch.forEach((m, i) => {
    if (!m) return;
    chips.push({ k: `CH${i + 1} Vpp`, v: f(m.vpp) });
    chips.push({ k: `CH${i + 1} max`, v: f(m.max) });
    chips.push({ k: `CH${i + 1} min`, v: f(m.min) });
    chips.push({ k: `CH${i + 1} avg`, v: f(m.mean) });
    if (m.freq > 0) chips.push({ k: `CH${i + 1} f`, v: f(m.freq, 1) });
  });
  return chips;
}

function MiniChart({ table, data }: { table: TableDef; data: string[][] }) {
  // Either x=column 0 / y=column 1, or (numeric column headers) one series per row
  const num = (s: string | undefined) => (s === undefined || s.trim() === "" ? NaN : parseFloat(s));
  const headNumeric = table.cols.every((c) => !isNaN(parseFloat(c)));
  const series: { name: string; pts: [number, number][] }[] = [];
  if (headNumeric) {
    table.rows.forEach((r, ri) => {
      const pts = table.cols.map((c, ci) => [parseFloat(c), num(data[ri]?.[ci])] as [number, number]).filter((p) => !isNaN(p[1]));
      if (pts.length) series.push({ name: r, pts });
    });
  } else {
    const pts = table.rows
      .map((r, ri) => {
        const x = !isNaN(num(data[ri]?.[0])) ? num(data[ri]?.[0]) : parseFloat(r);
        return [x, num(data[ri]?.[1])] as [number, number];
      })
      .filter((p) => !isNaN(p[0]) && !isNaN(p[1]));
    if (pts.length) series.push({ name: table.cols[1], pts });
  }
  if (!series.length) return <div className="py-3 text-xs text-[var(--color-mute)]">—</div>;
  const all = series.flatMap((s) => s.pts);
  const [x0, x1] = [Math.min(0, ...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
  const [y0, y1] = [Math.min(0, ...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))];
  const W = 420,
    H = 200,
    pad = 30;
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - pad - 10);
  const sy = (y: number) => H - pad - ((y - y0) / (y1 - y0 || 1)) * (H - pad - 10);
  const palette = ["#f7e521", "#22c3f0", "#f2b33d", "#3ccf7a", "#ff6464", "#c08bff"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full rounded-lg bg-black/30" direction="ltr">
      <line x1={pad} y1={sy(0)} x2={W - 10} y2={sy(0)} stroke="#667" />
      <line x1={sx(0)} y1={10} x2={sx(0)} y2={H - pad} stroke="#667" />
      <text x={W - 12} y={H - 8} fontSize="10" fill="#9aa4b2" textAnchor="end">
        {x1.toPrecision(3)}
      </text>
      <text x={pad + 2} y={16} fontSize="10" fill="#9aa4b2">
        {y1.toPrecision(3)}
      </text>
      {series.map((s, i) => (
        <g key={s.name}>
          <polyline
            fill="none"
            stroke={palette[i % palette.length]}
            strokeWidth="1.8"
            points={[...s.pts].sort((a, b) => a[0] - b[0]).map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")}
          />
          {s.pts.map((p, k) => (
            <circle key={k} cx={sx(p[0])} cy={sy(p[1])} r="2.5" fill={palette[i % palette.length]} />
          ))}
          <text x={W - 14} y={22 + i * 12} fontSize="9" fill={palette[i % palette.length]} textAnchor="end">
            {s.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

const EMPTY_TABLE: string[][] = [];

function ResultsTable({ expId, table }: { expId: string; table: TableDef }) {
  const { lang, t } = useT();
  const data = useBench((s) => s.results[expId]?.[table.id] ?? EMPTY_TABLE);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [showPlot, setShowPlot] = useState(false);
  const chips = useReadingChips();
  const setCell = useBench.getState().setCell;
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold">{table.title[lang]}</div>
        <button className="btn !py-1 !text-[11px]" data-on={showPlot} onClick={() => setShowPlot(!showPlot)}>
          <Icon name="chart" size={16} /> {t("plot")}
        </button>
      </div>
      <div className="scroll-thin overflow-x-auto" dir="ltr">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border border-white/10 bg-white/5 px-1 py-1" />
              {table.cols.map((c) => (
                <th key={c} className="border border-white/10 bg-white/5 px-1 py-1 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, ri) => (
              <tr key={r}>
                <td className="border border-white/10 bg-white/5 px-1.5 py-1 whitespace-nowrap">{r}</td>
                {table.cols.map((c, ci) => (
                  <td key={c} className="border border-white/10 p-0">
                    <input
                      className="w-full min-w-[3.4rem] !rounded-none !border-0 !bg-transparent text-center font-mono focus:!bg-[rgba(242,179,61,0.15)]"
                      value={data[ri]?.[ci] ?? ""}
                      onFocus={() => setFocus([ri, ci])}
                      onChange={(e) => setCell(expId, table.id, ri, ci, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {focus && (
        <div className="mt-1.5 flex flex-wrap gap-1" title={t("capture")}>
          {chips.map((c) => (
            <button
              key={c.k}
              className="chip hover:bg-white/15"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setCell(expId, table.id, focus[0], focus[1], c.v);
                const nextCol = focus[1] + 1 < table.cols.length ? [focus[0], focus[1] + 1] : [focus[0] + 1, 0];
                setFocus(nextCol as [number, number]);
              }}
            >
              <span className="text-[var(--color-mute)]">{c.k}</span> {c.v}
            </button>
          ))}
        </div>
      )}
      {showPlot && <MiniChart table={table} data={data} />}
    </div>
  );
}

function GuideToggle() {
  const { t } = useT();
  const guide = useUi((s) => s.guide);
  return (
    <button className="btn" data-on={guide} title={t("guideTip")} onClick={() => useUi.getState().setGuide(!guide)}>
      <Icon name="target" size={16} /> {t("guide")}
    </button>
  );
}

export function ExperimentPanel() {
  const { t, lang } = useT();
  const expId = useBench((s) => s.experimentId);
  const stepIdx = useBench((s) => s.step);
  const moduleId = useBench((s) => s.moduleId);
  const st = useBench.getState();
  const [check, setCheck] = useState<CheckResult | null>(null);
  const exp = expId ? EXPERIMENT_BY_ID[expId] : null;
  const step = exp?.steps[Math.min(stepIdx, exp.steps.length - 1)];
  const title = useMemo(() => (exp ? `${lang === "ar" ? "التجربة" : "Experiment"} ${exp.no} — ${exp.title[lang]}` : t("experiments")), [exp, lang, t]);

  return (
    <Panel title={title} onClose={() => st.setPanel("none")}>
      {!exp && (
        <div className="flex flex-col gap-2">
          {EXPERIMENTS.map((e) => (
            <button
              key={e.id}
              className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-start hover:bg-white/[0.08]"
              onClick={() => {
                st.setExperiment(e.id);
                if (useBench.getState().moduleId !== e.module) st.setModule(e.module);
                setCheck(null);
              }}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-accent)]/15 font-mono text-sm text-[var(--color-accent)]">{e.no}</span>
              <span>
                <span className="block text-sm font-medium">{e.title[lang]}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--color-mute)]">{getModule(e.module).code} · {e.objective[lang]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {exp && step && (
        <div>
          <button className="btn mb-3 !py-1 !text-[11px]" onClick={() => st.setExperiment(null)}>
            <Icon name={lang === "ar" ? "next" : "prev"} size={16} /> {t("experiments")}
          </button>
          <p className="mb-3 text-xs leading-relaxed text-[var(--color-mute)]">
            <b className="text-[var(--color-ink)]">{t("objective")}: </b>
            {exp.objective[lang]}
          </p>
          {moduleId !== exp.module && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-2 text-xs">
              <span>
                {t("needModule")} {getModule(exp.module).code}
              </span>
              <button className="btn !py-1" onClick={() => st.setModule(exp.module)}>
                {t("insertModule")}
              </button>
            </div>
          )}
          {/* steps */}
          <div className="mb-2 flex flex-wrap gap-1">
            {exp.steps.map((s, i) => (
              <button key={i} className="btn !px-2 !py-1 !text-[11px]" data-on={i === stepIdx} onClick={() => (st.setStep(i), setCheck(null))}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-1.5 text-sm font-semibold">
              {t("step")} {stepIdx + 1}: {step.title[lang]}
            </div>
            <p className="text-[13px] leading-relaxed">{step.text[lang]}</p>
            {step.expect && (
              <p className="mt-2 text-xs text-[var(--color-ok)]">
                <b>{t("expect")}:</b> {step.expect[lang]}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(step.wires || step.leads || step.knobs) && (
                <button className="btn" onClick={() => (applyStep(exp.module, step), setCheck(null))}>
                  <Icon name="plug" size={16} /> {t("autowire")}
                </button>
              )}
              {(step.wires || step.leads) && (
                <button className="btn" onClick={() => setCheck(checkStep(exp.module, step))}>
                  <Icon name="check" size={16} /> {t("check")}
                </button>
              )}
              {(step.wires || step.leads) && <GuideToggle />}
            </div>
            {check && (
              <div className={`mt-2 rounded-lg p-2 text-xs ${check.ok ? "bg-[var(--color-ok)]/15 text-[var(--color-ok)]" : "bg-[var(--color-bad)]/10 text-[#ffb3b3]"}`}>
                {check.ok ? (
                  t("allGood")
                ) : (
                  <>
                    <b>{t("missing")}:</b>
                    <ul className="mt-1 list-disc ps-4" dir="ltr">
                      {check.missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <div className="mt-3 flex justify-between">
              <button className="btn" disabled={stepIdx === 0} onClick={() => (st.setStep(stepIdx - 1), setCheck(null))}>
                {t("prev")}
              </button>
              <button className="btn" disabled={stepIdx >= exp.steps.length - 1} onClick={() => (st.setStep(stepIdx + 1), setCheck(null))}>
                {t("next")}
              </button>
            </div>
          </div>
          <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">{t("results")}</h3>
          {exp.tables.map((tb) => (
            <ResultsTable key={tb.id} expId={exp.id} table={tb} />
          ))}
          {exp.questions && (
            <>
              <h3 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">{t("questions")}</h3>
              <ol className="list-decimal ps-5 text-xs leading-relaxed">
                {exp.questions.map((q, i) => (
                  <li key={i}>{q[lang]}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
