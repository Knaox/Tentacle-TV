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
import type { LiveContent } from "@tentacle-tv/offline-core";
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
  show(content: LiveContent, texts: LiveTexts, channelName: string): void;
  end(): void;
}

const iosSurface: LiveSurface = {
  available: liveActivitiesEnabled,
  show(content, texts) {
    void presentLiveActivity({
      headline: texts.headline,
      status: texts.status,
      readyInLabel: texts.readyInLabel,
      phase: content.phase,
      fraction: content.percent === null ? -1 : content.percent / 100,
      endsAtMs: content.endsAtMs ?? 0,
      deepLink: texts.deepLink,
    });
  },
  end() {
    void endLiveActivity();
  },
};

const androidSurface: LiveSurface = {
  available: canShowLiveTransfer,
  show(content, texts, channelName) {
    showLiveTransfer({
      channelName,
      title: texts.headline,
      text: texts.status,
      subText: content.percent === null ? null : `${content.percent} %`,
      progress: content.percent ?? -1,
      endsAtMs: content.endsAtMs ?? 0,
      deepLink: texts.deepLink,
    });
  },
  end() {
    hideLiveTransfer();
  },
};

const noSurface: LiveSurface = { available: () => false, show() {}, end() {} };

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
