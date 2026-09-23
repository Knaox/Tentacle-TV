import { useEffect, useState } from "react";
import { DeviceEventEmitter, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { plog } from "../utils/playerDiag";

/** Jalon d'ouverture PrismCore tel que le pont l'émet (`prismCheckpoint`). */
interface PrismCheckpointEvent {
  gen: number;
  phase: string;
  elapsedMs: number;
  origin?: string;
  segments?: number;
}

/** Phase → clé `player:` affichée sous le titre de l'écran de chargement. */
function phaseKey(e: PrismCheckpointEvent): string | null {
  switch (e.phase) {
    case "sourceOpened": return "prismOpening";
    case "streamInfoResolved": return "prismResolving";
    // Séquentiel = source sans index de keyframes (MKV sans Cues, MPEG-TS) au
    // PREMIER visionnage : la seule attente longue ET explicable — et celle qui
    // ne se reproduit pas, grâce au cache d'index de PrismCore.
    case "segmentPlanReady": return e.origin === "sequential" ? "prismIndexing" : "prismPreparing";
    case "firstVideoSegmentWritten": return "prismStarting";
    default: return null;   // playlistServable : l'URL arrive, l'écran va disparaître
  }
}

/**
 * Ce que PrismCore est en train de faire pendant l'ouverture, pour l'écran de
 * chargement (tvOS). Écoute `prismCheckpoint` tant que `active` ; pas de filtre
 * de génération : une seule session démarre pendant que l'écran est affiché,
 * et le gen n'est connu qu'au retour de `start()`. `DeviceEventEmitter` plutôt
 * que `NativeEventEmitter(PrismBridge)` : sur Android le module n'existe pas
 * et le constructeur lèverait — même choix que useSpeechRecognition.
 */
export function useTVPrismProgress(active: boolean): { label: string | null } {
  const { t } = useTranslation("player");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    if (!active || Platform.OS !== "ios") { setKey(null); return; }
    setKey(null);
    const sub = DeviceEventEmitter.addListener("prismCheckpoint", (e: PrismCheckpointEvent) => {
      plog("prism", `jalon gen=${e.gen} ${e.phase}${e.origin ? ` (${e.origin}${e.segments != null ? `, ${e.segments} seg` : ""})` : ""} +${e.elapsedMs} ms`);
      setKey(phaseKey(e));
    });
    return () => sub.remove();
  }, [active]);

  return { label: key ? t(key) : null };
}
