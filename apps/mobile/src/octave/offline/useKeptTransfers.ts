/**
 * Octave (mobile) — les transferts de la musique gardée vus par l'interface :
 * la liste gardée (`useKeptMusic`, qui avance déjà à chaque progression du
 * moteur) croisée avec le débit lissé du magasin de progression
 * (`offline-core/react`, nourri par `OfflineEventsBinding`).
 *
 * `useKeptTransferSummary()` est aussi celui de l'entrée du hub (sous-titre
 * « 3 en transfert · 42 % »).
 */

import { useMemo, useRef } from "react";
import { getProgressFor } from "@tentacle-tv/offline-core/react";
import { holdRate, type HeldRate, type KeptTransferSummary, transferSummary } from "./transferModel";
import { useKeptMusic } from "./useKeptMusic";

export function useKeptTransferSummary(): KeptTransferSummary {
  const kept = useKeptMusic();
  const held = useRef<HeldRate | null>(null);
  return useMemo(() => {
    const summary = transferSummary(kept.tracks, getProgressFor);
    // Le débit tenu entre deux titres : le temps restant ne clignote pas à chaque passage.
    held.current = holdRate(held.current, summary.rateBps, Date.now());
    const rateBps = held.current.rateBps;
    if (summary.rateBps !== null || rateBps === null || summary.etaMs !== null || summary.running === 0 || summary.bytesTotal === null) return summary;
    const remaining = Math.max(0, summary.bytesTotal - summary.bytesDone);
    return { ...summary, rateBps, etaMs: (remaining / rateBps) * 1_000 };
  }, [kept.tracks]);
}
