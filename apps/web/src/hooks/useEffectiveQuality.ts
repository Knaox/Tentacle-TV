import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { buildQualityLadder, isPresetOffered, findPreset } from "@tentacle-tv/shared";
import type { MediaSource, QualityKey, QualityPreset } from "@tentacle-tv/shared";
import { startBitrateMeasurement, automaticCap } from "../lib/bitratePolicy";
import { useToast } from "../contexts/ToastContext";

/**
 * Échelle + preset + CAP AUTOMATIQUE de qualité — extrait de `useWatchSession`
 * (budget 300 lignes) et étendu de la politique de débit.
 *
 * Le cap vit désormais sur TOUTES les plateformes (la politique web est
 * active) : quand la connexion MESURÉE ne porte pas le fichier, un palier de
 * l'échelle remplace « Originale ». Deux règles produit :
 *  - un choix MANUEL de l'utilisateur prime toujours (cap sur « original » seul) ;
 *  - le cap est une photographie PAR ITEM, prise quand la source est connue —
 *    jamais de renégociation en cours de lecture. Mesure absente (serveur sans
 *    BitrateTest, échec réseau) → aucun cap, lecture comme avant.
 */
export function useEffectiveQuality(args: {
  mediaSource: MediaSource | undefined;
  itemId: string | undefined;
  qualityKey: QualityKey;
  setQualityKey: (k: QualityKey) => void;
  /** Position de relance de session : change quand le flux est reconstruit —
   *  le cap se re-photographie à ce moment-là (jamais en lecture continue). */
  startTicks?: number;
  /** false : lecture locale/hors ligne — ni mesure, ni cap, ni toast. */
  enabled?: boolean;
}): {
  qualityPresets: QualityPreset[];
  qualityPreset: QualityPreset;
  quality: number | null;
  qualityMaxHeight: number | undefined;
  autoCapActive: boolean;
  /** Le mode « Auto » est armé : « Originale » sans choix manuel — badge au
   *  sélecteur, que le cap morde (palier réduit) ou pas (débit suffisant). */
  autoModeArmed: boolean;
  /** Clé AFFICHÉE au sélecteur : le palier réellement servi, cap compris —
   *  « Originale » cochée pendant un cap mentait au menu. */
  qualityKeyEffective: QualityKey;
  /** Sélection MANUELLE du menu : désarme d'abord le cap (re-choisir
   *  « Originale » redevient possible et définitif pour cet item). */
  setQualityKeyManual: (k: QualityKey) => void;
} {
  const { mediaSource, itemId, qualityKey, setQualityKey, startTicks = 0, enabled = true } = args;
  const client = useJellyfinClient();
  const { show } = useToast();
  const { t } = useTranslation("player");

  // Mesure amorcée dès le montage du lecteur (fire-and-forget, cache 10 min) :
  // sur un réseau local elle aboutit avant la première décision de flux.
  useEffect(() => {
    if (enabled) startBitrateMeasurement(client);
  }, [client, enabled]);

  // Les paliers dépendent de la source : proposer un transcodage plus lourd
  // que l'original serait absurde (cf. buildQualityLadder).
  const qualityPresets = useMemo(() => buildQualityLadder(mediaSource), [mediaSource]);
  const qualityPreset = findPreset(qualityKey, qualityPresets);

  // Garde-fou : l'échelle étant calculée d'après la source, un palier proposé
  // sur un fichier peut disparaître sur le suivant. Sans ce repli, la clé
  // survivrait sans correspondance — sélecteur sans sélection visible, et un
  // débit rendu par `findPreset` qui ne serait plus celui affiché.
  useEffect(() => {
    if (!isPresetOffered(qualityKey, qualityPresets)) setQualityKey("original");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityPresets, qualityKey]);

  // Cap photographié par (item, session) : pris à l'arrivée de la source,
  // re-pris quand startTicks bouge (relance de flux) — une lecture partie en
  // Originale parce que la mesure n'était pas prête bascule à la relance
  // suivante au lieu de ramer à vie. Jamais recalculé en lecture continue.
  const sessionKey = `${itemId}|${startTicks}`;
  const evaluatedRef = useRef<string | undefined>(undefined);
  const capRef = useRef<QualityPreset | null>(null);
  if (sessionKey !== evaluatedRef.current && mediaSource) {
    evaluatedRef.current = sessionKey;
    capRef.current = enabled ? automaticCap(mediaSource) : null;
  }
  const capAuto = sessionKey === evaluatedRef.current ? capRef.current : null;

  // L'utilisateur qui touche le menu reprend la main : le cap se désarme pour
  // cet item, quel que soit son choix — y compris « Originale ».
  const disarmedRef = useRef<string | undefined>(undefined);
  const setQualityKeyManual = useCallback((k: QualityKey) => {
    disarmedRef.current = itemId;
    setQualityKey(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, setQualityKey]);

  const autoModeArmed = enabled && qualityKey === "original" && disarmedRef.current !== itemId;
  const autoCapActive = autoModeArmed && capAuto != null;
  const effectivePreset = autoCapActive && capAuto ? capAuto : qualityPreset;

  // Le dire UNE fois par item — le toast s'efface seul (4 s).
  const notifiedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (autoCapActive && notifiedRef.current !== itemId) {
      notifiedRef.current = itemId;
      show("info", t("qualityReduced"));
    }
  }, [autoCapActive, itemId, show, t]);

  return {
    qualityPresets,
    qualityPreset,
    quality: effectivePreset.bitrate,
    qualityMaxHeight: effectivePreset.height ?? undefined,
    autoCapActive,
    autoModeArmed,
    qualityKeyEffective: autoCapActive && capAuto ? capAuto.key : qualityKey,
    setQualityKeyManual,
  };
}
