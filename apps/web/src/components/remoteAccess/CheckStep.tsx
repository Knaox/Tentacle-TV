import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Radar } from "lucide-react";
import type { RemoteAccessState } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { CheckResults } from "./CheckResults";
import { RemoteAccessError, useRunRemoteCheck } from "./remoteAccessApi";
import { WanCheck } from "./WanCheck";

/**
 * Étape 3 : le test d'ouverture. Le service externe met jusqu'à une trentaine
 * de secondes ; le bouton le dit, et rien d'autre n'est bloqué pendant ce temps.
 */
export function CheckStep({ state }: { state: RemoteAccessState }) {
  const { t } = useTranslation("remoteAccess");
  const run = useRunRemoteCheck();
  const [wanIp, setWanIp] = useState("");
  const report = run.data ?? state.lastCheck;
  const serviceHost = state.checkServiceUrl ? new URL(state.checkServiceUrl).host : null;
  const failure = run.error instanceof RemoteAccessError && run.error.status === 429 ? t("outcome_rate_limited") : run.error ? t("checkFailed") : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => run.mutate()} disabled={run.isPending || state.checkServiceUrl === null} className={cls.bp}>
          <Radar size={16} aria-hidden="true" className={run.isPending ? "motion-safe:animate-pulse" : ""} />
          {run.isPending ? t("checking") : report ? t("rerunCheck") : t("runCheck")}
        </button>
        {serviceHost ? <span className="text-xs text-content-quaternary">{serviceHost}</span> : null}
      </div>
      {state.checkServiceUrl === null ? <p className="text-sm text-content-tertiary">{t("outcome_service_disabled")}</p> : null}
      {failure ? (
        <p role="alert" className="text-sm text-status-error-fg">
          {failure}
        </p>
      ) : null}
      <div aria-live="polite" aria-busy={run.isPending}>
        {report ? <CheckResults report={report} wanIp={wanIp} /> : null}
      </div>
      <WanCheck value={wanIp} onChange={setWanIp} publicIpV4={report?.outcome === "done" ? report.publicIp.v4 : null} />
    </div>
  );
}
