import { useTranslation } from "react-i18next";
import { RotateCw, Wrench } from "lucide-react";
import { ActionPill } from "../sessions/ActionPill";
import { SegmentRunView } from "../../segmentPlugins/SegmentRunView";
import { offersRestartAnyway } from "../../segmentPlugins/segmentRunModel";
import { useSegmentRun, useStartSegmentSetup } from "./segmentPluginsApi";

/**
 * Le geste de l'administration : installer ou réparer les trois greffons de
 * passages (dépôts, installation, redémarrage de Jellyfin, réglages). Un seul
 * bouton principal ; « Redémarrer maintenant » n'apparaît que si le passage
 * a laissé Jellyfin tourner parce que quelqu'un regardait.
 */
export function SegmentPluginsRepair() {
  const { t } = useTranslation("segmentPlugins");
  const run = useSegmentRun();
  const start = useStartSegmentSetup();
  const current = run.data ?? null;
  const busy = start.isPending || current?.running === true;
  const shown = current && (current.running || current.finishedAt) ? current : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ActionPill
          size="sm"
          tone="brand"
          icon={Wrench}
          label={busy ? t("running") : t("repair")}
          status={busy ? "busy" : "idle"}
          disabled={busy}
          onClick={() => start.mutate({})}
        />
        {offersRestartAnyway(current) && !busy ? (
          <ActionPill size="sm" icon={RotateCw} label={t("restartAnyway")} onClick={() => start.mutate({ restartWhilePlaying: true })} />
        ) : null}
      </div>
      {offersRestartAnyway(current) && !busy ? <p className="text-xs text-content-tertiary">{t("restartAnywayHint")}</p> : null}
      {start.isError ? <p role="alert" className="text-xs text-status-error-fg">{t("requestError")}</p> : null}
      {shown ? (
        <div className="rounded-xl border border-line-subtle p-3">
          <SegmentRunView run={shown} />
        </div>
      ) : null}
    </div>
  );
}
