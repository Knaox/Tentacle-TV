import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { SegmentSetupRun, SetupCompleteResponse } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { runSegmentSetup } from "./applySegments";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { pathOf } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";
import { SegmentRunView } from "../segmentPlugins/SegmentRunView";

type Phase = "segments" | "configure" | "session" | "done";
type LineState = "pending" | "running" | "ok" | "error";

/** Les réglages conseillés dont le titre s'affiche, par geste (clés `rec_<id>`). */
const ADVICE_TITLE: Record<string, string> = {
  setMetadataLanguage: "rec_metadataLanguage",
  enableTrickplay: "rec_trickplay",
  enableRealtimeMonitor: "rec_realtimeMonitor",
  enableHevcEncoding: "rec_hevcEncoding",
  shortenLibraryUpdateDelay: "rec_libraryUpdateDelay",
};

/** Où reprendre : ce qui est fait n'est pas refait. */
function firstPhase(done: { configured: boolean; segmentsDone: boolean; wantSegments: boolean }): Phase {
  if (done.configured) return "session";
  return !done.wantSegments || done.segmentsDone ? "configure" : "segments";
}

/**
 * L'installation proprement dite. Jellyfin NEUF : la détection des passages
 * (greffons, redémarrage compris — AVANT les bibliothèques, pour qu'aucun
 * scan ne soit coupé), les bibliothèques, la session. Jellyfin DÉJÀ
 * configuré : SEULEMENT ce qui a été coché (passages, puis réglages), aucune
 * bibliothèque, puis la session. Une étape qui échoue se relance seule, sans
 * refaire ce qui a réussi ; les passages et les réglages ne bloquent jamais.
 */
export function ApplyScreen({ wizard, onSession }: { wizard: Wizard; onSession: (session: SetupCompleteResponse) => void }) {
  const { t } = useTranslation(["setupWizard", "segmentPlugins"]);
  const client = useJellyfinClient();
  const { data, patch, next } = wizard;
  const joined = pathOf(data.context) === "configured";
  const wantSegments = !joined || data.advice?.segments === true;
  const configured = (joined ? data.adviceOutcomes : data.outcomes) !== null;
  const segmentsDone = data.segments !== undefined;
  const [phase, setPhase] = useState<Phase>(() => firstPhase({ configured, segmentsDone, wantSegments }));
  const [segmentRun, setSegmentRun] = useState<SegmentSetupRun | null>(data.segments ?? null);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    try {
      let current = firstPhase({ configured, segmentsDone, wantSegments });
      if (current === "segments") {
        patch({ segments: await runSegmentSetup(setSegmentRun) });
        current = "configure";
        setPhase(current);
      }
      if (current === "configure") {
        if (joined) {
          const actions = data.advice?.actions ?? [];
          const adviceOutcomes = actions.length
            ? await setupApi.applyAdvice({ actions, language: data.locale.language, country: data.locale.country })
            : [];
          patch({ adviceOutcomes });
        } else {
          const outcomes = data.plans.length
            ? await setupApi.createLibraries({ libraries: data.plans, metadataLanguage: data.locale.language, metadataCountry: data.locale.country })
            : [];
          patch({ outcomes });
        }
        current = "session";
        setPhase(current);
      }
      if (!data.credentials) throw new SetupApiError("jf_bad_credentials");
      const session = await setupApi.complete({
        username: data.credentials.username,
        password: data.credentials.password,
        deviceId: client.getLoginDeviceId(),
        client: client.getClientName(),
        device: client.getDeviceName(),
        ...(data.clientUrl ? { jellyfinClientUrl: data.clientUrl } : {}),
      });
      patch({ session, credentials: null });
      onSession(session);
      setPhase("done");
      next();
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    }
  }, [joined, configured, segmentsDone, wantSegments, data.advice, data.plans, data.locale, data.credentials, data.clientUrl, client, patch, onSession, next]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const line = (label: string, state: LineState) => (
    <li className="flex items-center gap-2 text-sm">
      {state === "ok" ? (
        <CircleCheck size={16} aria-hidden="true" className="text-status-success-fg" />
      ) : state === "error" ? (
        <CircleAlert size={16} aria-hidden="true" className="text-status-error-fg" />
      ) : (
        <LoaderCircle size={16} aria-hidden="true" className={state === "running" ? "text-content-secondary motion-safe:animate-spin" : "text-content-quaternary"} />
      )}
      <span className={state === "pending" ? "text-content-tertiary" : "text-content-primary"}>{label}</span>
    </li>
  );
  const segState: LineState = phase === "segments" ? "running" : data.segments === null ? "error" : "ok";
  const configState: LineState = phase === "segments" ? "pending" : phase === "configure" ? (error ? "error" : "running") : "ok";
  const sessionState: LineState = phase === "segments" || phase === "configure" ? "pending" : phase === "session" ? (error ? "error" : "running") : "ok";
  const adviceOutcomes = data.adviceOutcomes ?? [];

  return (
    <WizardFrame title={t("applyTitle")} subtitle={t("applySubtitle")} position={wizard.position} total={wizard.total} server={wizard.server}>
      <div className="space-y-4" aria-live="polite">
        <ul className="space-y-2">
          {wantSegments ? line(t("segmentPlugins:wizardLine"), segState) : null}
          {wantSegments && segmentRun ? (
            <li className="pl-6">
              <SegmentRunView run={segmentRun} />
            </li>
          ) : wantSegments && data.segments === null ? (
            <li className="pl-6 text-xs text-content-tertiary">{t("segmentPlugins:wizardSkipped")}</li>
          ) : null}
          {line(joined ? t("applyAdvice") : t("applyLibraries"), configState)}
          {joined && data.adviceOutcomes && adviceOutcomes.length === 0 ? <li className="pl-6 text-xs text-content-tertiary">{t("applyAdviceNone")}</li> : null}
          {adviceOutcomes.map((outcome) => (
            <li key={outcome.action} className={`pl-6 text-xs ${outcome.status === "failed" ? "text-status-error-fg" : "text-content-tertiary"}`}>
              {t(`adviceOutcome_${outcome.status}`, { name: t(ADVICE_TITLE[outcome.action] ?? outcome.action) })}
            </li>
          ))}
          {(joined ? [] : data.outcomes ?? []).map((outcome) => (
            <li key={outcome.name} className={`pl-6 text-xs ${outcome.status === "failed" ? "text-status-error-fg" : "text-content-tertiary"}`}>
              {t(`outcome_${outcome.status}`, { name: outcome.name })}
              {outcome.error ? ` — ${t(`error_${outcome.error}`)}` : ""}
            </li>
          ))}
          {line(t("applySession"), sessionState)}
        </ul>
        <SetupErrorLine code={error} onRetry={() => void run()} />
      </div>
    </WizardFrame>
  );
}
