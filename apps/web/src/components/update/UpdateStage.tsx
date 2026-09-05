import { useTranslation } from "react-i18next";
import type { UpdatePhase } from "../../lib/updateTypes";
import { Spinner } from "../ui/Spinner";
import { UpdateProgress } from "./UpdateProgress";

interface UpdateStageProps {
  phase: UpdatePhase;
  progress: number;
  indeterminate: boolean;
  visible: boolean;
}

/**
 * La mise en scène des phases actives : téléchargement (barre), installation
 * et redémarrage (anneau). Même hiérarchie que la phase « disponible » : le
 * bandeau des versions reste au-dessus, seul le corps change.
 */
export function UpdateStage({ phase, progress, indeterminate, visible }: UpdateStageProps) {
  const { t } = useTranslation("notifications");

  if (phase === "downloading") {
    return (
      <div className="space-y-3">
        <UpdateProgress progress={progress} indeterminate={indeterminate} visible={visible} />
        <p className="text-center text-sm font-medium text-content-secondary">
          {indeterminate
            ? t("notifications:downloadingByStore")
            : t("notifications:downloading", { progress: Math.round(progress) })}
        </p>
        <p className="text-center text-xs text-content-quaternary">{t("notifications:restartHint")}</p>
      </div>
    );
  }

  const label =
    phase === "restarting" ? t("notifications:updateRestarting") : t("notifications:updateInstalling");
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <Spinner size="lg" paused={!visible} label={label} />
      <p className="text-sm font-medium text-content-secondary">{label}</p>
    </div>
  );
}
