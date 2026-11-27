"use client";
import { Icon } from "./icons";
import { useState } from "react";
import { useBench } from "@/store/bench";
import { EXPERIMENT_BY_ID } from "@/lab/experiments";
import { useT } from "./i18n";
import { useUi } from "./uiState";
import { usePhone } from "./usePhone";

export function TopBar() {
  const { t, lang } = useT();
  const panel = useBench((s) => s.panel);
  const expId = useBench((s) => s.experimentId);
  const step = useBench((s) => s.step);
  const sound = useBench((s) => s.sound);
  const insight = useUi((s) => s.insight);
  const st = useBench.getState();
  const exp = expId ? EXPERIMENT_BY_ID[expId] : null;
  const [more, setMore] = useState(false);
  const { phone } = usePhone();
  const extras = (
    <>
      <button className="btn" data-on={sound} title={t("sound")} onClick={() => st.setSound(!sound)}>
        <Icon name={sound ? "soundOn" : "soundOff"} /> {phone && <span>{t("sound")}</span>}
      </button>
      <button className="btn" data-on={panel === "help"} onClick={() => st.setPanel("help")}>
        <Icon name="help" /> {phone && <span>{t("help")}</span>}
      </button>
      <button className="btn font-semibold" onClick={() => st.setLang(lang === "ar" ? "en" : "ar")}>
        {lang === "ar" ? "EN" : "عربي"}
      </button>
    </>
  );
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between ${phone ? "gap-1.5 p-2" : "flex-wrap gap-2 p-3"}`}>
      <div className={`glass pointer-events-auto flex shrink-0 items-center rounded-xl ${phone ? "gap-1.5 px-1.5 py-1.5" : "gap-3 px-3 py-2"}`}>
        <div className={`grid place-items-center rounded-lg bg-[var(--color-accent)] font-bold text-black ${phone ? "h-7 w-7 text-[12px]" : "h-8 w-8 text-[13px]"}`}>KL</div>
        {!phone && (
          <div className="leading-tight">
            <div className="text-sm font-semibold">{t("appTitle")}</div>
            <div className="text-[11px] text-[var(--color-mute)]">
              {exp ? `${lang === "ar" ? "التجربة" : "Exp."} ${exp.no} · ${exp.title[lang]} · ${t("step")} ${step + 1}/${exp.steps.length}` : t("appSub")}
            </div>
          </div>
        )}
      </div>
      <div className={`glass pointer-events-auto relative flex items-center rounded-xl ${phone ? "gap-1 px-1.5 py-1.5" : "gap-1.5 px-2 py-1.5"}`}>
        <button className="btn" data-on={panel === "experiment"} onClick={() => st.setPanel("experiment")}>
          <Icon name="flask" /> {!phone && <span>{t("experiments")}</span>}
        </button>
        <button className="btn" data-on={panel === "saves"} onClick={() => st.setPanel("saves")}>
          <Icon name="saves" /> {!phone && <span>{t("saves")}</span>}
        </button>
        <button className="btn" data-on={insight} title={t("insightTip")} onClick={() => useUi.getState().setInsight(!insight)}>
          <Icon name="xray" /> <span className="hidden lg:inline">{t("insight")}</span>
        </button>
        {!phone && <div className="flex items-center gap-1.5">{extras}</div>}
        {/* phones: the rarely used buttons live in a small menu */}
        {phone && (
          <button className="btn" data-on={more} aria-label="more" onClick={() => setMore(!more)}>
            <Icon name="more" />
          </button>
        )}
        {phone && more && (
          <div className="glass absolute end-0 top-[calc(100%+6px)] z-40 flex w-44 flex-col gap-1 rounded-xl p-1.5" onClick={() => setMore(false)}>
            {extras}
          </div>
        )}
      </div>
    </div>
  );
}
