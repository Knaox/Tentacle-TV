import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JellyfinSetupReport, SetupActionId, SetupCheck } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { JellyfinAdminError, useSetupApply } from "./jellyfinAdminApi";
import { SetupCheckRow } from "./SetupCheckRow";
import { applyErrorKey, languageChoice } from "./setupPresentation";

/**
 * Les lignes des réglages de Jellyfin et leurs gestes en un clic — partagées
 * par la liste complète (Services, `SetupChecklist`) et par la
 * recommandation « Jellyfin » de la vue d'ensemble, qui n'en montre que ce
 * qui reste à faire. Un geste à la fois (le serveur le refuse de toute
 * façon), l'état relu arrive avec la réponse : la ligne passe à « Fait »
 * sans rechargement.
 */
export function SetupRows({ report, checks }: { report: JellyfinSetupReport; checks: readonly SetupCheck[] }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const { show } = useToast();
  const apply = useSetupApply();
  const [running, setRunning] = useState<SetupActionId | null>(null);
  const [failed, setFailed] = useState<SetupActionId | null>(null);
  const language = useMemo(
    () => languageChoice(i18n.language, typeof navigator === "undefined" ? "" : navigator.language ?? ""),
    [i18n.language],
  );

  const onApply = useCallback(async (action: SetupActionId) => {
    setRunning(action);
    setFailed(null);
    try {
      await apply.mutateAsync({
        action,
        ...(action === "setMetadataLanguage" ? { language: language.language, country: language.country } : {}),
      });
      show("success", t("applied"));
    } catch (error) {
      setFailed(action);
      show("error", t(applyErrorKey(error instanceof JellyfinAdminError ? error.code : null)));
    } finally {
      setRunning(null);
    }
  }, [apply, language, show, t]);

  return (
    <ul className="divide-y divide-line-subtle">
      {checks.map((check) => (
        <SetupCheckRow
          key={check.id}
          check={check}
          dashboardUrl={report.dashboardUrl}
          jellyfinVersion={report.jellyfinVersion}
          language={language}
          running={running}
          failed={failed}
          onApply={(action) => void onApply(action)}
        />
      ))}
    </ul>
  );
}
