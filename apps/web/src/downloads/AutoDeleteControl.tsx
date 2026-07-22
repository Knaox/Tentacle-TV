import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { setAutoDeleteAfterWatch, type DownloadEntry } from "./api";
import { AutoDeleteSelect } from "./AutoDeleteSelect";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** « Se supprime dans X » (relatif < 24 h) ou « Se supprime le <date> ». */
function scheduleText(scheduledAtSec: number, t: Translate, locale: string): string {
  const deltaMin = Math.max(0, Math.round((scheduledAtSec * 1000 - Date.now()) / 60_000));
  if (deltaMin < 60) {
    return t("autoDeleteScheduledIn", { time: `${Math.max(1, deltaMin)} min` });
  }
  if (deltaMin < 24 * 60) {
    const h = Math.floor(deltaMin / 60);
    const m = deltaMin % 60;
    return t("autoDeleteScheduledIn", { time: m > 0 ? `${h} h ${m} min` : `${h} h` });
  }
  const date = new Date(scheduledAtSec * 1000).toLocaleString(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return t("autoDeleteScheduledOn", { date });
}

/**
 * Contrôle d'auto-suppression d'une ligne de téléchargement : sélecteur de
 * délai (Désactivée / Immédiatement / 1 h / 6 h / 12 h / 24 h) + visuel de
 * l'échéance quand elle est posée (l'item a été vu). Le compte à rebours se
 * rafraîchit toutes les minutes ; la suppression elle-même est portée par la
 * purge Rust (tick 60 s + rattrapage au démarrage si l'app était fermée).
 */
export function AutoDeleteControl({ entry, userId }: { entry: DownloadEntry; userId: string }) {
  const { t, i18n } = useTranslation("downloads");
  const [, tick] = useReducer((x: number) => x + 1, 0);

  const scheduledAt = entry.autoDeleteAfterWatch ? entry.deleteScheduledAt : null;
  useEffect(() => {
    if (scheduledAt == null) return;
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  return (
    <div className="flex flex-col items-end gap-1">
      <AutoDeleteSelect
        compact
        value={entry.autoDeleteAfterWatch ? entry.autoDeleteDelayMinutes : null}
        onChange={(value) => void setAutoDeleteAfterWatch(userId, entry.id, value != null, value ?? 0)}
      />
      {scheduledAt != null && (
        <span className="text-[10px] font-medium text-status-warning-fg">
          {scheduleText(scheduledAt, t as Translate, i18n.language)}
        </span>
      )}
    </div>
  );
}
