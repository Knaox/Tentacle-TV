import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";
import { evaluateServerLinks, linksProgress } from "@tentacle-tv/shared";
import { ActionPill } from "../sessions/ActionPill";
import { AdminNotice, AdminSection } from "../kit";
import { isOutdatedLinksServer } from "../../serverLinks/serverLinksApi";
import { useServerLinks } from "../../serverLinks/useServerLinks";
import { LinkCheckRow } from "./LinkCheckRow";

/**
 * « Accès au serveur » dans la vue d'ensemble : le lien public et la lecture
 * directe, chacun avec l'état que le serveur vient de sonder, pourquoi on le
 * recommande, et le champ où le régler. C'est aussi là qu'on revient après
 * avoir passé l'étape « Accès » de l'assistant d'installation.
 *
 * Le verdict est celui de l'assistant (`evaluateServerLinks`, shared).
 */
export function ServerLinksSection() {
  const { t } = useTranslation("serverLinks");
  const query = useServerLinks();
  const checks = useMemo(() => (query.data ? evaluateServerLinks(query.data) : null), [query.data]);
  const progress = checks ? linksProgress(checks) : null;

  const recheck = (
    <ActionPill
      size="sm"
      icon={RotateCw}
      label={query.isFetching ? t("checking") : t("recheck")}
      status={query.isFetching ? "busy" : "idle"}
      onClick={() => void query.refetch()}
    />
  );

  return (
    <AdminSection
      title={t("sectionTitle")}
      description={t("sectionDescription")}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {progress && <Progress done={progress.done} total={progress.total} />}
          {checks && recheck}
        </div>
      }
      flush
    >
      {checks ? (
        <ul className="divide-y divide-line-subtle" aria-busy={query.isFetching}>
          {checks.map((check) => <LinkCheckRow key={check.id} check={check} />)}
        </ul>
      ) : (
        <div className="p-5">
          {query.isError ? (
            isOutdatedLinksServer(query.error) ? (
              <AdminNotice>{t("outdatedServer")}</AdminNotice>
            ) : (
              <AdminNotice tone="error" action={recheck}>{t("loadError")}</AdminNotice>
            )
          ) : (
            <div aria-hidden="true" className="space-y-3">
              {[0, 1].map((i) => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}
            </div>
          )}
        </div>
      )}
    </AdminSection>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation("serverLinks");
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium tabular-nums text-content-secondary">
        {done === total ? t("allDone") : t("progress", { done, total })}
      </span>
      <div
        role="progressbar"
        aria-label={t("progressLabel")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-fill-soft"
      >
        {/* Une largeur posée, jamais animée : la barre ne repeint rien. */}
        <div className={`h-full rounded-full ${done === total ? "bg-status-success" : "bg-[var(--brand)]"}`} style={{ width: `${String(Math.round((done / total) * 100))}%` }} />
      </div>
    </div>
  );
}
