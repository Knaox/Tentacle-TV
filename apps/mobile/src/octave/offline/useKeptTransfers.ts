/**
 * Octave (mobile) — les transferts de la musique gardée vus par l'interface :
 * la liste gardée (`useKeptMusic`, qui avance déjà à chaque progression du
 * moteur) croisée avec le débit lissé du magasin de progression
 * (`offline-core/react`, nourri par `OfflineEventsBinding`).
 *
 * Un battement toutes les `STALL_CHECK_MS` tant que des titres sont en cours :
 * sans progression, rien d'autre ne redessinerait la carte, et le blocage
 * (coupure réseau, erreur du serveur que le moteur relance seul) ne se dirait
 * jamais. Au repos, aucun minuteur.
 *
 * `useKeptTransferSummary()` est aussi celui de l'entrée du hub (sous-titre
 * « 3 en transfert · 42 % »).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { getProgressFor } from "@tentacle-tv/offline-core/react";
import { holdRate, isStalled, trackAdvance, transferSummary, type Advance, type HeldRate, type KeptTransferSummary } from "./transferModel";
import { useKeptMusic } from "./useKeptMusic";

const STALL_CHECK_MS = 5_000;

function useHeartbeat(enabled: boolean): number {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setBeat((n) => n + 1), STALL_CHECK_MS);
    return () => clearInterval(timer);
  }, [enabled]);
  return beat;
}

export function useKeptTransferSummary(): KeptTransferSummary {
  const kept = useKeptMusic();
  const held = useRef<HeldRate | null>(null);
  const advance = useRef<Advance | null>(null);
  const base = useMemo(() => transferSummary(kept.tracks, getProgressFor), [kept.tracks]);
  const beat = useHeartbeat(base.running > 0);
  return useMemo(() => {
    // `beat` : relire l'horloge pour dire un blocage même quand rien n'arrive.
    void beat;
    const now = Date.now();
    advance.current = trackAdvance(advance.current, base.bytesDone, now);
    const stalled = isStalled(advance.current, base.running, now);
    // Le débit tenu entre deux titres : le temps restant ne clignote pas à chaque passage.
    held.current = holdRate(held.current, base.rateBps, now);
    const rateBps = held.current.rateBps;
    if (base.rateBps !== null || rateBps === null || base.etaMs !== null || base.running === 0 || base.bytesTotal === null) return { ...base, stalled };
    const remaining = Math.max(0, base.bytesTotal - base.bytesDone);
    return { ...base, stalled, rateBps, etaMs: (remaining / rateBps) * 1_000 };
  }, [base, beat]);
}
