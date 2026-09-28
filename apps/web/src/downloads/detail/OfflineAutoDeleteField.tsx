import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { setAutoDeleteAfterWatch, type DownloadEntry } from "../api";
import { AutoDeleteSelect } from "../AutoDeleteSelect";
import { scheduleText } from "../AutoDeleteControl";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * « Supprimer après visionnage » dans la carte « Sur cet appareil » : le même
 * sélecteur que l'écran des téléchargements, en pleine taille, et l'échéance
 * quand elle court (le titre a été vu). Le compte à rebours ne bat qu'à la
 * minute, et seulement pendant qu'une échéance existe.
 */
export function OfflineAutoDeleteField({ entry }: { entry: DownloadEntry }) {
  const { t, i18n } = useTranslation("downloads");
  const userId = useUserId();
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const scheduledAt = entry.autoDeleteAfterWatch ? entry.deleteScheduledAt : null;

  useEffect(() => {
    if (scheduledAt == null) return;
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-content-secondary">{t("autoDeleteAfterWatch")}</span>
        <AutoDeleteSelect
          value={entry.autoDeleteAfterWatch ? entry.autoDeleteDelayMinutes : null}
          onChange={(value) => {
            if (userId) void setAutoDeleteAfterWatch(userId, entry.id, value != null, value ?? 0);
          }}
        />
      </div>
      <span className="text-xs text-content-quaternary">
        {scheduledAt != null
          ? <span className="font-medium text-status-warning-fg">{scheduleText(scheduledAt, t as Translate, i18n.language)}</span>
          : t("detailAutoDeleteHint")}
      </span>
    </div>
  );
}
