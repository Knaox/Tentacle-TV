import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { SetupCompleteResponse } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cls } from "../../pages/adminUtils";
import { Field } from "../admin/services/Field";
import { hostAndPort, isValidClientUrl, serverState } from "./jellyfinChoice";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

const primary = `${cls.bp} w-full sm:w-auto`;

/**
 * Tout ce qui va être fait, et l'adresse de Jellyfin que recevront les
 * applications (lecture directe) : proposée d'après l'adresse de cette page et
 * le port publié, modifiable ici — jamais un nom Docker.
 */
export function RecapScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const { data } = wizard;
  const [clientUrl, setClientUrl] = useState(data.clientUrl);
  const invalid = clientUrl.trim() !== "" && !isValidClientUrl(clientUrl);
  const jellyfin = data.probe
    ? t("recapJellyfinLine", { name: data.probe.serverName, version: data.probe.version, ...hostAndPort(data.probe.url), state: t(`jfState_${serverState(data.probe)}`) })
    : data.jellyfinUrl || data.context?.jellyfin.url || "—";
  const rows: Array<[string, string]> = [
    [t("recapJellyfin"), jellyfin],
    [t("recapAccount"), data.credentials?.username ?? "—"],
    [t("recapLocale"), `${t(`lang_${data.locale.language}`)} · ${t(`country_${data.locale.country}`)}`],
    [t("recapLibraries"), data.plans.length ? data.plans.map((p) => `${p.name} (${p.paths[0]})`).join(" · ") : t("recapNothing")],
  ];
  return (
    <WizardFrame title={t("recapTitle")} subtitle={t("recapSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <dl className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-xs font-medium text-content-tertiary">{label}</dt>
            <dd className="break-words text-sm text-content-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          wizard.patch({ clientUrl: clientUrl.trim().replace(/\/+$/, "") });
          wizard.next();
        }}
        className="mt-6 space-y-6"
      >
        <Field
          label={t("recapClientUrl")}
          hint={t("recapClientUrlHint")}
          value={clientUrl}
          onChange={(e) => setClientUrl(e.target.value)}
          error={invalid ? t("recapClientUrlInvalid") : null}
          placeholder="http://192.168.1.20:8096"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={invalid} className={primary}>
          {t("recapApply")}
        </button>
      </form>
    </WizardFrame>
  );
}

type Phase = "libraries" | "session" | "done";

/**
 * L'installation proprement dite : les bibliothèques, puis la session ouverte
 * avec le compte administrateur — comme une connexion ordinaire. Une étape qui
 * échoue se relance seule, sans refaire ce qui a réussi.
 */
export function ApplyScreen({ wizard, onSession }: { wizard: Wizard; onSession: (session: SetupCompleteResponse) => void }) {
  const { t } = useTranslation("setupWizard");
  const client = useJellyfinClient();
  const [phase, setPhase] = useState<Phase>(wizard.data.outcomes ? "session" : "libraries");
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const started = useRef(false);
  const { data, patch, next } = wizard;

  const run = useCallback(async () => {
    setError(null);
    try {
      let current: Phase = data.outcomes ? "session" : "libraries";
      if (current === "libraries") {
        const outcomes = data.plans.length
          ? await setupApi.createLibraries({ libraries: data.plans, metadataLanguage: data.locale.language, metadataCountry: data.locale.country })
          : [];
        patch({ outcomes });
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
  }, [data.outcomes, data.plans, data.locale, data.credentials, data.clientUrl, client, patch, onSession, next]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const line = (label: string, state: "pending" | "running" | "ok" | "error") => (
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
  const libState = phase === "libraries" ? (error ? "error" : "running") : "ok";
  const sessionState = phase === "libraries" ? "pending" : phase === "session" ? (error ? "error" : "running") : "ok";

  return (
    <WizardFrame title={t("applyTitle")} subtitle={t("applySubtitle")} position={wizard.position} total={wizard.total}>
      <div className="space-y-4" aria-live="polite">
        <ul className="space-y-2">
          {line(t("applyLibraries"), libState)}
          {(data.outcomes ?? []).map((outcome) => (
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
