/**
 * Où l'activité en direct s'affiche : la Live Activity d'iOS (écran
 * verrouillé, Dynamic Island) ou la notification des transferts d'Android.
 * Les deux reçoivent la MÊME décision (`livePublish.ts` d'offline-core) et les
 * MÊMES mots (`liveText.ts`) ; seul le dessin change.
 *
 * Aucune des deux ne décompte en JavaScript : iOS a `Text(timerInterval:)`,
 * Android son chronomètre décroissant — ils avancent seuls, application
 * suspendue comprise. Le JavaScript ne republie qu'un changement.
 */

import { Platform } from "react-native";
import type { LiveContent, LiveSurfaceOutcome } from "@tentacle-tv/offline-core";
import {
  canShowLiveTransfer,
  endLiveActivity,
  hideLiveTransfer,
  liveActivitiesEnabled,
  presentLiveActivity,
  showLiveTransfer,
} from "../../../modules/offline-storage";
import type { LiveTexts } from "./liveText";

export interface LiveSurface {
  /** Le build et l'appareil savent-ils l'afficher ? */
  available(): boolean;
  /** Dessine ; la promesse dit ce que le système en a fait (`refused` : à retenter). */
  show(content: LiveContent, texts: LiveTexts, channelName: string): Promise<LiveSurfaceOutcome>;
  end(): void;
}

/**
 * Les appels à ActivityKit, UN À LA FOIS et dans l'ordre demandé. Chaque appel
 * du module natif est une tâche Swift à part : sans cette file, la fin d'un
 * lot pouvait passer APRÈS le démarrage du suivant (activité effacée sitôt
 * posée) et deux démarrages se croiser (deux activités).
 */
let iosQueue: Promise<unknown> = Promise.resolve();
function enqueueIos<T>(run: () => Promise<T>): Promise<T> {
  const next = iosQueue.then(run, run);
  iosQueue = next.catch(() => undefined);
  return next;
}

const iosSurface: LiveSurface = {
  available: liveActivitiesEnabled,
  show(content, texts) {
    return enqueueIos(async () => {
      const outcome = await presentLiveActivity({
        headline: texts.headline,
        status: texts.status,
        readyInLabel: texts.readyInLabel,
        phase: content.phase,
        fraction: content.percent === null ? -1 : content.percent / 100,
        endsAtMs: content.endsAtMs ?? 0,
        deepLink: texts.deepLink,
      });
      if (outcome.kind === "refused") console.warn(`[suivi-direct] Live Activity refusée : ${outcome.cause}`);
      return outcome.kind === "refused" ? "refused" : outcome.kind;
    });
  },
  end() {
    void enqueueIos(endLiveActivity);
  },
};

const androidSurface: LiveSurface = {
  available: canShowLiveTransfer,
  show(content, texts, channelName) {
    // `false` : la notification n'a pas pu être posée (permission refusée).
    const shown = showLiveTransfer({
      channelName,
      title: texts.headline,
      text: texts.status,
      subText: content.percent === null ? null : `${content.percent} %`,
      progress: content.percent ?? -1,
      endsAtMs: content.endsAtMs ?? 0,
      deepLink: texts.deepLink,
    });
    return Promise.resolve(shown ? "shown" : "refused");
  },
  end() {
    hideLiveTransfer();
  },
};

const noSurface: LiveSurface = { available: () => false, show: () => Promise.resolve("refused"), end() {} };

export function platformLiveSurface(): LiveSurface {
  if (Platform.OS === "ios") return iosSurface;
  if (Platform.OS === "android") return androidSurface;
  return noSurface;
}

/**
 * Cet appareil sait-il montrer le suivi en direct ? Android avec un build
 * récent ; iOS 16.2+ avec les Activités en direct permises dans les réglages
 * du système. Le réglage « Suivi en direct » ne se montre qu'à cette condition.
 */
export function liveTransfersSupported(): boolean {
  return platformLiveSurface().available();
}
