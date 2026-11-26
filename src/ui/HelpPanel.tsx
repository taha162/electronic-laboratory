"use client";
import { useEffect, useState } from "react";
import { useBench } from "@/store/bench";
import { Panel } from "./ExperimentPanel";
import { useT } from "./i18n";

export function HelpPanel() {
  const { t, tl } = useT();
  return (
    <Panel title={t("help")} onClose={() => useBench.getState().setPanel("none")}>
      <ul className="flex flex-col gap-2 text-[13px] leading-relaxed">
        {tl("helpBody").map((l) => (
          <li key={l} className="rounded-lg bg-white/[0.04] px-3 py-2">
            {l}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function Welcome() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("mosul-elab-welcomed")) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem("mosul-elab-welcomed", "1");
    } catch {}
  };
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/30 p-4" onClick={close}>
      <div className="glass max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-lg font-semibold">{t("welcomeTitle")}</h2>
        <p className="text-sm leading-relaxed text-[var(--color-mute)]">{t("welcomeBody")}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={() => (close(), useBench.getState().setPanel("help"))}>
            {t("help")}
          </button>
          <button
            className="btn"
            data-on
            onClick={() => {
              close();
              useBench.getState().setPanel("experiment");
            }}
          >
            {t("start")}
          </button>
        </div>
      </div>
    </div>
  );
}
