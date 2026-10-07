import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JellyfinSetupReport, SetupActionId, SetupCheck } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { JellyfinAdminError, useSetupApply } from "./jellyfinAdminApi";
import { SetupCheckRow } from "./SetupCheckRow";
import { ShowMore } from "../kit/ShowMore";
import { applyErrorKey, languageChoice } from "./setupPresentation";

/**
 * Les lignes des réglages de Jellyfin et leurs gestes en un clic — partagées
 * par la liste complète (Services, `SetupChecklist`) et par la
 * recommandation « Jellyfin » de la vue d'ensemble, qui n'en montre que ce
 * qui reste à faire. Un geste à la fois (le serveur le refuse de toute
 * façon), l'état relu arrive avec la réponse : la ligne passe à « Fait »
 * sans rechargement.
 *
 * `foldSettled` : ce qui est en place (fait, inutile ici) attend « Voir les
 * N réglages déjà en place » — la liste montre d'abord ce qui reste à faire.
 */
const SETTLED: ReadonlySet<SetupCheck["state"]> = new Set(["done", "not-needed"]);

export function SetupRows({ report, checks, foldSettled = false }: { report: JellyfinSetupReport; checks: readonly SetupCheck[]; foldSettled?: boolean }) {
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

  const row = (check: SetupCheck) => (
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
  );
  const open = foldSettled ? checks.filter((check) => !SETTLED.has(check.state)) : checks;
  const settled = foldSettled ? checks.filter((check) => SETTLED.has(check.state)) : [];

  return (
    <>
      {open.length > 0 && <ul className="divide-y divide-line-subtle">{open.map(row)}</ul>}
      {settled.length > 0 && (
        <ShowMore label={t("setupShowSettled", { count: settled.length })} className={`px-3 py-2 ${open.length > 0 ? "border-t border-line-subtle" : ""}`}>
          <ul className="-mx-3 divide-y divide-line-subtle">{settled.map(row)}</ul>
        </ShowMore>
      )}
    </>
  );
}
