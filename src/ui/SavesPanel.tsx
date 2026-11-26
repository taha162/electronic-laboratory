"use client";
import { useRef, useState } from "react";
import { useBench, type SavedExperiment } from "@/store/bench";
import { EXPERIMENT_BY_ID } from "@/lab/experiments";
import { getModule } from "@/lab/modules";
import { Panel } from "./ExperimentPanel";
import { useT } from "./i18n";

export function SavesPanel() {
  const { t, lang } = useT();
  const saves = useBench((s) => s.saves);
  const expId = useBench((s) => s.experimentId);
  const st = useBench.getState();
  const [name, setName] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const defName = () => {
    const e = expId ? EXPERIMENT_BY_ID[expId] : null;
    return `${e ? `Exp ${e.no}` : getModule(st.moduleId).code} · ${new Date().toLocaleString(lang === "ar" ? "ar-IQ" : "en-GB")}`;
  };
  return (
    <Panel title={t("saves")} onClose={() => st.setPanel("none")}>
      <div className="flex gap-2">
        <input type="text" className="flex-1" placeholder={t("saveName")} value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn"
          onClick={() => {
            st.saveExperiment(name.trim() || defName());
            setName("");
            st.notify("✓ " + t("save"));
          }}
        >
          {t("save")}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          className="btn"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ format: "mosul-elab/1", saves }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `electronics-lab-saves-${Date.now()}.json`;
            a.click();
          }}
        >
          ⤓ {t("exportJ")}
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          ⤒ {t("importJ")}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const j = JSON.parse(await f.text()) as { saves?: SavedExperiment[] };
              if (Array.isArray(j.saves)) useBench.setState((s) => ({ saves: [...j.saves!, ...s.saves] }));
            } catch {
              st.notify("✕ JSON");
            }
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {!saves.length && <div className="text-xs text-[var(--color-mute)]">{t("noSaves")}</div>}
        {saves.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm">{s.name}</div>
              <div className="text-[11px] text-[var(--color-mute)]">
                {getModule(s.snapshot.moduleId).code} · {s.snapshot.wires.length} wires · {new Date(s.date).toLocaleDateString()}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button className="btn !py-1" onClick={() => (st.loadSave(s.id), st.notify("✓ " + t("load")))}>
                {t("load")}
              </button>
              <button className="btn !py-1" onClick={() => st.deleteSave(s.id)}>
                {t("del")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
