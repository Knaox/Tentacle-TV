import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import {
  addPlayerPipListener, configurePlayerPip, enterPlayerPip, isPlayerPipSupported, resetPlayerPip,
} from "../../../modules/player-pip";
import type { PlayerEngineHandle } from "../engine/types";
import { canOfferPip, pipAspect, pipSkipDelta, shouldAutoEnterPip, type PipAction, type PipState } from "./pipPolicy";

interface Options extends PipState {
  engineRef: RefObject<PlayerEngineHandle | null>;
  videoWidth?: number;
  videoHeight?: number;
  /** Les gestes de la fenêtre passent par les MÊMES gestionnaires que les boutons. */
  setPaused: (paused: boolean) => void;
  seekBy: (delta: number) => void;
  /** La fenêtre a été fermée : quitter le lecteur (arrêt rapporté à Jellyfin). */
  onClosed: () => void;
}

export interface PlayerPip {
  active: boolean;
  /** Le bouton est-il proposé ? */
  available: boolean;
  enter: () => void;
  /** iOS : l'état rapporté par le moteur (AVKit). */
  onEngineChange: (active: boolean) => void;
}

/**
 * L'image dans l'image du lecteur, iOS et Android, sur UNE règle
 * (`pipPolicy.ts`). iOS : chaque moteur a la sienne (AVKit), ouverte d'elle-même
 * en quittant l'app pendant une lecture, et par le bouton (`enterPictureInPicture`).
 * Android : l'ACTIVITÉ entière (module `player-pip`), armée seulement pendant
 * une lecture ; ses gestes (lecture/pause, ±10 s) reviennent ici.
 *
 * Watch Together : un geste de la fenêtre est un geste de l'utilisateur — il
 * passe par `setPaused` / `seekBy`, que la synchro du groupe observe déjà.
 */
export function usePlayerPip(options: Options): PlayerPip {
  const { t } = useTranslation("player");
  const [active, setActive] = useState(false);
  const androidSupported = useRef(Platform.OS === "android" && isPlayerPipSupported()).current;
  const handlers = useRef(options);
  handlers.current = options;

  const state: PipState = {
    paused: options.paused, started: options.started, ended: options.ended,
    failed: options.failed, remote: options.remote,
  };
  const autoEnter = shouldAutoEnterPip(state);
  const offer = canOfferPip(state);
  const aspect = pipAspect(options.videoWidth, options.videoHeight);

  // Android : la plateforme suit la règle à chaque changement (lecture, pause, format).
  useEffect(() => {
    if (!androidSupported) return;
    configurePlayerPip({
      autoEnter,
      playing: !options.paused,
      aspectWidth: aspect.width,
      aspectHeight: aspect.height,
      labels: { play: t("pip.play"), pause: t("pip.pause"), rewind: t("pip.back10"), forward: t("pip.forward10") },
    });
  }, [androidSupported, autoEnter, options.paused, aspect.width, aspect.height, t]);

  // Android : le lecteur s'en va → plus d'entrée automatique depuis le reste de l'app.
  useEffect(() => {
    if (!androidSupported) return;
    const subs = [
      addPlayerPipListener("onPipModeChanged", ({ active: next }) => setActive(next)),
      addPlayerPipListener("onPipAction", ({ action }) => applyAction(action, handlers.current)),
      addPlayerPipListener("onPipClosed", () => handlers.current.onClosed()),
    ];
    return () => {
      subs.forEach((sub) => sub?.remove());
      resetPlayerPip();
    };
  }, [androidSupported]);

  const enter = useCallback(() => {
    if (Platform.OS === "android") void enterPlayerPip();
    else handlers.current.engineRef.current?.enterPictureInPicture?.();
  }, []);

  return {
    active,
    available: offer && (Platform.OS === "ios" || androidSupported),
    enter,
    onEngineChange: setActive,
  };
}

function applyAction(action: PipAction, options: Options): void {
  if (action === "play") options.setPaused(false);
  else if (action === "pause") options.setPaused(true);
  else options.seekBy(pipSkipDelta(action));
}
