import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bitrateForItem, cachedBitrate, primeBitrateMeasure, useJellyfinClient } from "@tentacle-tv/api-client";
import { buildQualityLadder, capForBitrate, findPreset, isPresetOffered } from "@tentacle-tv/shared";
import type { MediaSource, QualityKey, QualityPreset } from "@tentacle-tv/shared";
import { MOBILE_BITRATE_MEASURE } from "@/utils/bitrateMeasureOptions";

/**
 * Échelle + palier + CAP AUTOMATIQUE de qualité du lecteur mobile — extrait de
 * `usePlayerPlayback` (budget 300 lignes), même partition que le téléviseur et
 * le web (`useEffectiveQuality`) :
 *  - défaut « Originale » + cap armé tant qu'aucun choix MANUEL — le choix
 *    prime toujours, jamais de rétrogradation par-dessus ;
 *  - le cap est PHOTOGRAPHIÉ à chaque résolution de flux (chaque
 *    `fetchPlaybackInfo` ouvre une nouvelle session Jellyfin) — jamais en
 *    lecture continue ; mesure absente/périmée, ou prise sur une AUTRE voie
 *    que celle du flux (direct coupé, hors du réseau local) → aucun cap,
 *    jamais de blocage ;
 *  - la clé AFFICHÉE au menu est le palier servi, cap compris.
 */
export function usePlayerQuality(args: { itemId: string; mediaSource: MediaSource | undefined }): {
  qualityPresets: QualityPreset[];
  /** Clé affichée au menu : palier servi, cap compris. */
  qualityKeyEffective: QualityKey;
  /** Un cap est appliqué au flux courant (le message « Qualité réduite »). */
  autoCapActive: boolean;
  /** Le palier du cap et la mesure qui l'a décidé — ce que le message dit. */
  autoCap: { bitrate: number | null; measuredBps: number | null } | null;
  /** Aucun choix manuel pour cet item : le mode « Auto » est armé. */
  autoModeArmed: boolean;
  /** Palier à servir à la PROCHAINE résolution de flux — photographie le cap
   *  (la mesure de la voie du flux au moment T) quand la clé est « original »
   *  non désarmée. */
  presetForFetch: () => QualityPreset;
  /** Avant de résoudre le flux : l'épisode suivant refait SA mesure de débit
   *  (`bitrateForItem`, api-client), le premier titre n'attend jamais. */
  settleBitrate: () => Promise<void>;
  /** Choix du menu : désarme le cap pour l'item, puis applique. */
  selectQualityManual: (key: QualityKey) => QualityPreset;
  /** Descente d'un palier pour un retry de transcodage (logique historique) —
   *  part du palier SERVI (cap compris), et vaut choix explicite. */
  degradeOneTier: () => QualityPreset | undefined;
} {
  const { itemId, mediaSource } = args;
  const client = useJellyfinClient();
  const [qualityKey, setQualityKey] = useState<QualityKey>("original");
  /** Cap réellement appliqué au DERNIER flux résolu — pour l'UI seulement. */
  const [appliedCap, setAppliedCap] = useState<QualityPreset | null>(null);
  const [capMeasured, setCapMeasured] = useState<number | null>(null);
  const disarmedRef = useRef<string | undefined>(undefined);

  // Filet du montage lecteur (le préchauffage vit aussi au lancement de
  // l'app, cf. AppProviders) : fire-and-forget, cache 10 min. MÊME réglage
  // que le lancement : sans la voie du média, ce filet remesurerait le proxy
  // et écraserait la mesure directe.
  useEffect(() => {
    primeBitrateMeasure(client, MOBILE_BITRATE_MEASURE);
  }, [client]);

  // Paliers calculés d'après la source : jamais au-dessus de son débit ni de
  // sa définition (cf. buildQualityLadder).
  const qualityPresets = useMemo(() => buildQualityLadder(mediaSource), [mediaSource]);

  // Garde-fou : l'échelle dépend de la source, un palier peut disparaître d'un
  // média à l'autre. Retomber sur « Originale » plutôt que sur une clé fantôme.
  useEffect(() => {
    if (!isPresetOffered(qualityKey, qualityPresets)) setQualityKey("original");
  }, [qualityPresets, qualityKey]);

  // Changement d'item : le cap affiché se vide (le désarmement, lui, est déjà
  // par item — la ref compare l'identifiant).
  useEffect(() => {
    setAppliedCap(null);
  }, [itemId]);

  const autoModeArmed = qualityKey === "original" && disarmedRef.current !== itemId;

  const presetForFetch = useCallback((): QualityPreset => {
    const manual = findPreset(qualityKey, qualityPresets);
    if (!(qualityKey === "original" && disarmedRef.current !== itemId)) {
      setAppliedCap(null);
      return manual;
    }
    const measured = cachedBitrate(client, MOBILE_BITRATE_MEASURE);
    const cap = capForBitrate(mediaSource, measured);
    setAppliedCap(cap);
    setCapMeasured(measured);
    return cap ?? manual;
  }, [qualityKey, qualityPresets, itemId, mediaSource, client]);

  const settleBitrate = useCallback(async () => {
    await bitrateForItem(client, itemId, MOBILE_BITRATE_MEASURE);
  }, [client, itemId]);

  const selectQualityManual = useCallback(
    (key: QualityKey): QualityPreset => {
      disarmedRef.current = itemId;
      setQualityKey(key);
      setAppliedCap(null);
      return findPreset(key, qualityPresets);
    },
    [itemId, qualityPresets]
  );

  const degradeOneTier = useCallback((): QualityPreset | undefined => {
    const fromKey = appliedCap?.key ?? qualityKey;
    const idx = qualityPresets.findIndex((p) => p.key === fromKey);
    const degraded = qualityPresets.slice(idx + 1).find((p) => p.bitrate != null);
    if (degraded) {
      disarmedRef.current = itemId;
      setQualityKey(degraded.key);
      setAppliedCap(null);
    }
    return degraded;
  }, [appliedCap, qualityKey, qualityPresets, itemId]);

  const autoCapActive = autoModeArmed && appliedCap != null;
  return {
    qualityPresets,
    qualityKeyEffective: autoCapActive && appliedCap ? appliedCap.key : qualityKey,
    autoCapActive,
    autoCap: autoCapActive && appliedCap ? { bitrate: appliedCap.bitrate, measuredBps: capMeasured } : null,
    autoModeArmed,
    presetForFetch,
    settleBitrate,
    selectQualityManual,
    degradeOneTier,
  };
}
