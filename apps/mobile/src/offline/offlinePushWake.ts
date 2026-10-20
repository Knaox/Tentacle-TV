/**
 * L'iPhone réveillé par le serveur : une préparation tenue par le serveur
 * (`offline.serverPrepare`) s'est achevée sans que le téléphone la lise — son
 * transfert avait été coupé pendant que l'application dormait. iOS rend la
 * main une trentaine de secondes (`PushWake.swift`) : on relance tout de suite
 * ce qui attendait — pauses système, relances échues —, et les tâches remises à
 * la session d'arrière-plan vont au bout sans nous, par plage d'octets, sur un
 * fichier désormais complet.
 *
 * Lancement à froid (application tuée par le système) : le moteur n'existe pas
 * encore, et son démarrage remet de lui-même la file en route.
 */

import { useEffect } from "react";
import { AppState } from "react-native";
import { onOfflinePrepared } from "../../modules/offline-storage/pushWake";
import { setTransfersSuspended } from "./backgroundParallel";
import { offlineEngineIfStarted } from "./engineRuntime";

export function wakeForPrepared(): void {
  // Réveillée derrière, l'application l'est encore : plusieurs transferts
  // partent ensemble, et une coupure repart sans délai.
  setTransfersSuspended(AppState.currentState !== "active");
  const engine = offlineEngineIfStarted();
  if (engine === null) return;
  engine.resumeSystemPauses();
  engine.sweepRetries();
  engine.pump();
}

/** Monté une fois, avec le moteur (`OfflineRuntimeSync`). */
export function useOfflinePushWake(): void {
  useEffect(
    () =>
      onOfflinePrepared((itemId) => {
        console.log(`[hors-ligne-fond] réveil : préparation prête (${itemId})`);
        wakeForPrepared();
      }),
    [],
  );
}
