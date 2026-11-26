"use client";
import { useBench } from "@/store/bench";
import { EXPERIMENT_BY_ID } from "@/lab/experiments";
import { useT } from "./i18n";

export function TopBar() {
  const { t, lang } = useT();
  const mode = useBench((s) => s.mode);
  const panel = useBench((s) => s.panel);
  const quality = useBench((s) => s.quality);
  const expId = useBench((s) => s.experimentId);
  const step = useBench((s) => s.step);
  const st = useBench.getState();
  const exp = expId ? EXPERIMENT_BY_ID[expId] : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-xl px-3 py-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent)] text-[13px] font-bold text-black">KL</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{t("appTitle")}</div>
          <div className="text-[11px] text-[var(--color-mute)]">
            {exp ? `${lang === "ar" ? "التجربة" : "Exp."} ${exp.no} · ${exp.title[lang]} · ${t("step")} ${step + 1}/${exp.steps.length}` : t("appSub")}
          </div>
        </div>
        <div className="ms-2 flex rounded-lg bg-white/5 p-0.5">
          {(["experiment", "explore"] as const).map((m) => (
            <button key={m} className="btn !border-0 !py-1.5" data-on={mode === m} onClick={() => st.setMode(m)}>
              {t(m)}
            </button>
          ))}
        </div>
      </div>
      <div className="glass pointer-events-auto flex items-center gap-1.5 rounded-xl px-2 py-1.5">
        <button className="btn" data-on={panel === "experiment"} onClick={() => st.setPanel("experiment")}>
          ⚗ {t("experiments")}
        </button>
        <button className="btn" data-on={panel === "saves"} onClick={() => st.setPanel("saves")}>
          ⤓ {t("saves")}
        </button>
        <button className="btn" data-on={panel === "help"} onClick={() => st.setPanel("help")}>
          ?
        </button>
        <button className="btn" title={t("quality")} onClick={() => st.setQuality(quality === "high" ? "low" : "high")}>
          ◐ {quality === "high" ? t("high") : t("low")}
        </button>
        <button className="btn font-semibold" onClick={() => st.setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "EN" : "عربي"}
        </button>
      </div>
    </div>
  );
}
