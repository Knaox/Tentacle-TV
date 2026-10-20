import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { publicLog } from "../../modules/offline-storage/publicLog";
import { presentLocalNotification } from "@/services/localNotifications";
import { ensureNotificationPermission } from "@/services/pushNotifications";
import { isLiveTransfers, isNotifyReady } from "./deviceSettings";
import { listOfflineEntries, type OfflineEntry } from "./engineApi";
import { subscribeOfflineChanged } from "./engineRuntime";
import { entryTitle } from "./entryTitle";
import { INITIAL_READY_STATE, nextReadyStep, type ReadyState } from "./readyBatch";
import { summarizeReady } from "./readySummary";

interface Props {
  /** Le compte de l'APPAREIL, à qui le hors ligne appartient. Absent : l'identité en session. */
  ownerUserId?: string | null;
  /** Une session de profil est ouverte : rien ne s'annonce (le lot du compte continue). */
  hidden?: boolean;
}

/**
 * La notification « Prêt à regarder hors ligne » : UNE par lot — celle qui
 * reste quand le suivi en direct s'efface (`live/`) : avec le titre et son
 * numéro d'épisode s'il n'y en a qu'un, le nom de la série et le compte si tout
 * vient de la même, le compte seul sinon (voir `summarizeReady`) —, plus une
 * « Espace insuffisant » quand un transfert s'arrête faute de place. La
 * permission est demandée au premier transfert.
 *
 * Suit les évènements du MOTEUR et relit la base locale, hors React Query :
 * application derrière (Android, service de premier plan), la liste d'un
 * écran n'est pas forcément relue, et l'annonce se perdait. Quand l'annoncer :
 * `readyBatch.ts` — une pause ne retient plus les titres prêts (recette D4).
 */
export function OfflineReadyNotifier({ ownerUserId, hidden = false }: Props = {}) {
  const { t } = useTranslation("offline");
  const sessionUserId = useUserId();
  const userId = ownerUserId === undefined ? sessionUserId : ownerUserId;
  const tRef = useRef(t);
  tRef.current = t;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  useEffect(() => {
    if (userId === null) return;
    let state: ReadyState<OfflineEntry> = INITIAL_READY_STATE;
    const tick = (): void => {
      let entries: OfflineEntry[];
      try {
        entries = listOfflineEntries(userId);
      } catch {
        // Base indisponible (déconnexion en cours) : rien à annoncer.
        return;
      }
      const step = nextReadyStep(state, entries);
      state = step.state;
      // Le suivi en direct est lui aussi une notification (Android 13+ la demande).
      if (step.started && (isNotifyReady() || isLiveTransfers())) void ensureNotificationPermission();
      if (!isNotifyReady() || hiddenRef.current) return;
      const say = tRef.current;
      for (const entry of step.diskFull) {
        void presentLocalNotification(say("diskFullNotifTitle"), say("diskFullNotifBody", { title: entryTitle(entry) }), { type: "offline_disk_full" });
      }
      const summary = summarizeReady(step.ready);
      if (summary === null) return;
      // Un seul titre : le toucher l'ouvre ; plusieurs : le catalogue de l'appareil.
      void presentLocalNotification(say("readyNotifTitle"), say(summary.key, summary.params), {
        type: "offline_ready",
        ...(step.ready.length === 1 ? { itemId: step.ready[0]!.itemId } : {}),
      }).then((posted) => publicLog("transferts", `« Prêt à regarder » ${posted ? "posée" : "refusée (permission ?)"} : ${step.ready.length} titre(s)`));
    };
    tick();
    return subscribeOfflineChanged(tick);
  }, [userId]);

  return null;
}
