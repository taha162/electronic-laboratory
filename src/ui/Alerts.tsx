"use client";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { SOURCE_LIMITS } from "@/lab/netlist";
import { useT } from "./i18n";

/** realistic fault indicators: supplies in current limit, overheating and burnt parts */
export function Alerts() {
  const { t } = useT();
  const overload = useSim((s) => s.readings.overload);
  const stress = useSim((s) => s.readings.stress);
  const damaged = useBench((s) => s.damaged ?? []);
  if (!overload.length && !stress.length && !damaged.length) return null;
  const names = [...new Set(overload.map((id) => SOURCE_LIMITS[id]?.name ?? id))];
  return (
    <div className="pointer-events-auto absolute start-1/2 top-[5.6rem] z-20 flex max-w-[94vw] -translate-x-1/2 flex-col items-center gap-1.5 text-[13px] rtl:translate-x-1/2 md:top-[4.4rem] md:text-sm">
      {names.length > 0 && (
        <div className="glass flex items-center gap-2 rounded-full border-[#ff6464]/40 px-3 py-1.5 text-xs text-[#ffb3b3]">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#ff3b2f] shadow-[0_0_8px_#ff3b2f]" />
          ⚡ {t("overload")}: <b dir="ltr">{names.join(", ")}</b>
        </div>
      )}
      {stress.length > 0 && (
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-[#ffd59a]">
          🔥 {t("hot")}:{" "}
          <span dir="ltr">
            {stress.map((s) => `${s.label} ${s.power.toFixed(2)}W/${s.rating}W`).join(" · ")}
          </span>
        </div>
      )}
      {damaged.length > 0 && (
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
          💥 {t("burnt")}: <span dir="ltr">{damaged.map((d) => d.replace(/^[mu]\./, "")).join(", ")}</span>
          <button className="btn !py-1" onClick={() => useBench.getState().repairAll()}>
            {t("replace")}
          </button>
        </div>
      )}
    </div>
  );
}
