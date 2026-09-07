import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { presentLocalNotification } from "@/services/localNotifications";
import { ensureNotificationPermission } from "@/services/pushNotifications";
import { useNotifyReady } from "./deviceSettings";
import { entryTitle } from "./entryTitle";
import { summarizeReady } from "./readySummary";
import type { OfflineEntry } from "./engineApi";

const ACTIVE = new Set(["queued", "downloading", "paused"]);

function countActive(entries: Iterable<OfflineEntry>): number {
  let active = 0;
  for (const entry of entries) if (ACTIVE.has(entry.status)) active += 1;
  return active;
}

/**
 * La notification « Prêt hors ligne » : UNE par lot — quand la file se vide,
 * avec le titre et son numéro d'épisode s'il n'y en a qu'un, le nom de la
 * série et le compte si tout vient de la même, le compte seul sinon (voir
 * `summarizeReady`) —, plus une « Espace
 * insuffisant » quand un transfert s'arrête faute de place. La permission
 * est demandée au premier transfert. Ne rend rien ; suit la liste locale,
 * invalidée à chaque évènement du moteur.
 */
export function OfflineReadyNotifier() {
  const { t } = useTranslation("offline");
  const userId = useUserId();
  const notifyReady = useNotifyReady();
  const { data: entries } = useOfflineList(userId);
  const previousRef = useRef<Map<number, OfflineEntry> | null>(null);
  const completedRef = useRef<OfflineEntry[]>([]);

  useEffect(() => {
    if (!entries) return;
    const current = new Map(entries.map((entry) => [entry.id, entry] as const));
    const previous = previousRef.current;
    previousRef.current = current;
    // Premier passage : rien à comparer, on prend la photo.
    if (previous === null) return;

    const activeBefore = countActive(previous.values());
    const activeNow = countActive(current.values());
    if (notifyReady && activeBefore === 0 && activeNow > 0) void ensureNotificationPermission();

    for (const [id, entry] of current) {
      const before = previous.get(id);
      if (!before || before.status === entry.status) continue;
      if (entry.status === "complete") completedRef.current.push(entry);
      if (entry.status === "error" && entry.errorCode === "disk-full" && notifyReady) {
        void presentLocalNotification(t("diskFullNotifTitle"), t("diskFullNotifBody", { title: entryTitle(entry) }), { type: "offline_disk_full" });
      }
    }

    if (activeBefore > 0 && activeNow === 0 && completedRef.current.length > 0) {
      const done = completedRef.current;
      completedRef.current = [];
      if (!notifyReady) return;
      const summary = summarizeReady(done);
      if (summary === null) return;
      void presentLocalNotification(t("readyNotifTitle"), t(summary.key, summary.params), {
        type: "offline_ready",
      });
    }
  }, [entries, notifyReady, t]);

  return null;
}
