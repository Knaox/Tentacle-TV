import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { jellyfinAdvice, type ExistingLibrary, type JellyfinAdvice, type JellyfinSetupReport } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { AdviceChoice, Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

const linkBtn = "min-h-11 text-sm font-semibold text-content-secondary underline underline-offset-4 hover:text-content-primary";

/**
 * Un Jellyfin DÉJÀ configuré : Tentacle n'y crée rien (ses bibliothèques
 * sont seulement rappelées) et propose ses réglages conseillés — la règle du
 * tableau de bord (`jellyfinAdvice`), les gestes de l'administration. Tous
 * facultatifs, décochables ; ce que l'administrateur a réglé autrement est
 * montré sans être coché ; « Passer » ne change rien.
 */
export function RecommendedScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const { patch, next, data } = wizard;
  const [report, setReport] = useState<JellyfinSetupReport | null>(null);
  const [libraries, setLibraries] = useState<ExistingLibrary[] | null>(null);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<Set<string> | null>(data.advice ? new Set(data.advice.ids) : null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([setupApi.recommended(), setupApi.libraries()])
      .then(([read, found]) => {
        if (cancelled) return;
        setReport(read);
        setLibraries(found);
        patch({ existing: found });
      })
      .catch((err) => !cancelled && setError(err instanceof SetupApiError ? err.code : "internal"));
    return () => {
      cancelled = true;
    };
  }, [attempt, patch]);

  const advice = useMemo(() => (report ? jellyfinAdvice(report.checks, data.locale) : []), [report, data.locale]);
  const selected = checked ?? new Set(advice.filter((a) => a.preselected).map((a) => a.id));
  const toggle = (id: string) => {
    const nextSet = new Set(selected);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    setChecked(nextSet);
  };
  const save = (ids: ReadonlySet<string>) => {
    const chosen = advice.filter((a) => ids.has(a.id));
    const choice: AdviceChoice = {
      segments: chosen.some((a) => a.gesture === "segmentPlugins"),
      actions: chosen.flatMap((a) => (a.gesture === "segmentPlugins" ? [] : [a.gesture])),
      ids: chosen.map((a) => a.id),
    };
    // Un choix revu efface ce qui en découlait (un retour en arrière avant l'installation).
    patch({ advice: choice, adviceOutcomes: null, segments: undefined });
    next();
  };
  const loading = !report && !error;
  const unreadable = report?.error != null;

  return (
    <WizardFrame title={t("recTitle")} subtitle={t("recSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back} server={wizard.server}>
      <div className="space-y-5">
        <p className="text-sm text-content-secondary">
          {libraries === null
            ? t("loading")
            : libraries.length > 0
              ? t("recLibraries", { names: libraries.map((library) => library.name).join(" · ") })
              : t("recLibrariesNone")}
        </p>
        <SetupErrorLine code={error} onRetry={() => setAttempt((n) => n + 1)} />
        {loading ? (
          <div className="space-y-2" aria-live="polite">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 rounded-xl border border-line-subtle bg-fill-faint motion-safe:animate-pulse" />
            ))}
          </div>
        ) : null}
        {unreadable ? <p className="text-sm text-content-secondary">{t("recUnreadable")}</p> : null}
        {report && !unreadable && advice.length === 0 ? <p className="text-sm text-content-secondary">{t("recNothing")}</p> : null}
        {advice.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium text-content-tertiary">{t("recLegend")}</legend>
            {advice.map((item) => (
              <AdviceRow key={item.id} advice={item} checked={selected.has(item.id)} onToggle={() => toggle(item.id)} />
            ))}
          </fieldset>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" onClick={() => save(selected)} disabled={loading} className={`${cls.bp} w-full sm:w-auto`}>
            {t("next")}
          </button>
          <button type="button" onClick={() => save(new Set())} className={linkBtn}>
            {t("recSkip")}
          </button>
        </div>
      </div>
    </WizardFrame>
  );
}

export function AdviceRow({ advice, checked, onToggle }: { advice: JellyfinAdvice; checked: boolean; onToggle: () => void }) {
  const { t } = useTranslation("setupWizard");
  const value = (raw: string | null): string => {
    if (raw === null) return t("recValue_none");
    if (raw === "on" || raw === "off") return t(`recValue_${raw}`);
    if (advice.id !== "metadataLanguage") return raw;
    const [language = "", country = ""] = raw.split(" · ");
    return `${t(`lang_${language}`, { defaultValue: language })} · ${t(`country_${country}`, { defaultValue: country })}`;
  };
  const targets = advice.targets.join(" · ");
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ${
        checked ? "border-purple-400/50 bg-purple-500/10" : "border-line-subtle hover:bg-fill-faint"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 shrink-0 accent-purple-400" />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block font-semibold text-content-primary">{t(`rec_${advice.id}`)}</span>
        <span className="block text-sm text-content-secondary">{t(`rec_${advice.id}_why`)}</span>
        {advice.recommended !== null ? (
          <span className="block text-xs text-content-tertiary">{t("recChange", { current: value(advice.current), recommended: value(advice.recommended) })}</span>
        ) : null}
        {targets ? (
          <span className="block break-words text-xs text-content-tertiary">
            {t(advice.gesture === "segmentPlugins" ? "recTargetsPlugins" : "recTargetsLibraries", { names: targets })}
          </span>
        ) : null}
        {!advice.preselected ? <span className="block text-xs text-status-warning-fg">{t("recSetOtherwise")}</span> : null}
      </span>
    </label>
  );
}
