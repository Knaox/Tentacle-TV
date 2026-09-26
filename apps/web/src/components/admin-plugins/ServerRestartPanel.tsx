import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";
import { useNowTick } from "../../hooks/useAdminSessions";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { AdminNotice } from "../admin/kit";
import { ActionPill } from "../admin/sessions/ActionPill";
import { ActionError } from "./ActionError";
import { usePluginAdmin } from "./PluginAdminContext";
import { SERVER_KEY } from "./usePluginActions";
import type { InstalledPlugin } from "./types";

/**
 * Le redémarrage du serveur, du début à la fin, en tête de page :
 * - À FAIRE : l'activation d'un module serveur n'est appliquée qu'au
 *   redémarrage — lesquels, et le bouton, au moment que l'administrateur
 *   choisit (il interrompt les lectures) ;
 * - EN COURS : depuis combien de temps, et la page qui se remettra à jour ;
 * - TROP LONG : sans superviseur (Docker…), le serveur ne repart pas seul ;
 * - REVENU : avec les modules serveur qui n'ont pas démarré, s'il y en a.
 *
 * Le compteur de secondes est tenu hors de l'annonce (`aria-hidden`) : une
 * région `status` qui change chaque seconde serait relue chaque seconde.
 */
export function ServerRestartPanel({ installed }: { installed: InstalledPlugin[] | undefined }) {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const { restart, actions, locked } = usePluginAdmin();
  const [confirming, setConfirming] = useState(false);
  const { phase } = restart;
  const now = useNowTick(phase.kind === "waiting");
  const nameOf = (pluginId: string) => installed?.find((p) => p.pluginId === pluginId)?.name ?? pluginId;

  if (phase.kind === "waiting") {
    const seconds = Math.max(0, Math.round((now - phase.startedAt) / 1000));
    const elapsed = (
      <span aria-hidden="true" className="ml-2 font-normal tabular-nums text-content-tertiary">
        {t("elapsedSeconds", { count: seconds })}
      </span>
    );
    if (phase.stuck) {
      return (
        <AdminNotice
          tone="warning"
          role="status"
          title={<>{t("restartStuckTitle")}{elapsed}</>}
          action={<ActionPill size="sm" label={t("stopWatching")} onClick={restart.dismiss} />}
        >
          {t("restartStuckBody")}
        </AdminNotice>
      );
    }
    return (
      <AdminNotice
        tone="info"
        role="status"
        title={<>{phase.label ? t("restartingFor", { name: phase.label }) : t("restarting")}{elapsed}</>}
      >
        <p>{t("restartingBody")}</p>
        {/* Une barre qui passe : le travail avance, sans promettre de durée. */}
        <div aria-hidden="true" className="relative mt-2 h-1 max-w-sm overflow-hidden rounded-full bg-fill-soft">
          <div className="absolute inset-y-0 left-0 w-1/4 animate-loading-bar rounded-full bg-brand motion-reduce:w-full motion-reduce:animate-pulse" />
        </div>
      </AdminNotice>
    );
  }

  if (phase.kind === "back") {
    const failed = phase.failures.length > 0;
    return (
      <AdminNotice
        tone={failed ? "warning" : "success"}
        role="status"
        title={t("restartDone")}
        action={<ActionPill size="sm" label={t("common:close")} onClick={restart.dismiss} />}
      >
        {failed ? (
          <>
            <p>{t("restartDoneFailures")}</p>
            <ul className="mt-1 space-y-0.5">
              {phase.failures.map((failure) => (
                <li key={failure.pluginId} className="break-words">
                  <span className="font-medium text-content-primary">{nameOf(failure.pluginId)}</span>
                  {failure.detail && <span className="font-mono text-[11px] text-content-tertiary"> — {failure.detail}</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          t("restartDoneBody")
        )}
      </AdminNotice>
    );
  }

  const pending = (installed ?? []).filter((p) => p.restartRequired);
  if (pending.length === 0) return null;
  const serverAction = actions.states.get(SERVER_KEY);
  return (
    <>
      <AdminNotice
        tone="warning"
        title={t("restartRequiredTitle")}
        action={
          <ActionPill
            size="sm"
            tone="brand"
            icon={RotateCw}
            label={t("restartNow")}
            busyLabel={t("restartRequesting")}
            status={serverAction?.status === "busy" ? "busy" : serverAction?.status === "error" ? "error" : "idle"}
            disabled={locked && serverAction?.status !== "busy"}
            onClick={() => setConfirming(true)}
          />
        }
      >
        <ul className="space-y-0.5">
          {pending.map((p) => (
            <li key={p.id}>{t(p.enabled ? "restartWillStart" : "restartWillStop", { name: p.name })}</li>
          ))}
        </ul>
        {serverAction?.status === "error" && <ActionError action="restart" error={serverAction.error} className="mt-2" />}
      </AdminNotice>
      <ConfirmDialog
        open={confirming}
        title={t("restartConfirmTitle")}
        message={t("restartConfirmBody")}
        confirmLabel={t("restartNow")}
        cancelLabel={t("common:cancel")}
        onConfirm={() => {
          setConfirming(false);
          void actions.restartServer();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
