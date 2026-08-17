import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { construireEchelleQualite, presetEstPropose, trouverPreset } from "@tentacle-tv/shared";
import type { MediaSource, QualityKey, QualityPreset } from "@tentacle-tv/shared";
import { amorcerMesure, capAutomatique } from "../lib/politiqueDebit";
import { useToast } from "../contexts/ToastContext";

/**
 * Échelle + preset + CAP AUTOMATIQUE de qualité — extrait de `useWatchSession`
 * (budget 300 lignes) et étendu de la politique de débit.
 *
 * Le cap ne vit que sur téléviseur (`lib/politiqueDebit` y est substitué par la
 * version active) : quand la connexion MESURÉE ne porte pas le fichier, un
 * palier de l'échelle remplace « Originale ». Deux règles produit :
 *  - un choix MANUEL de l'utilisateur prime toujours (cap sur « original » seul) ;
 *  - le cap est une photographie PAR ITEM, prise quand la source est connue —
 *    jamais de renégociation en cours de lecture. Mesure absente (serveur sans
 *    BitrateTest, échec réseau) → aucun cap, lecture comme avant.
 */
export function useQualiteEffective(args: {
  mediaSource: MediaSource | undefined;
  itemId: string | undefined;
  qualityKey: QualityKey;
  setQualityKey: (k: QualityKey) => void;
}): {
  qualityPresets: QualityPreset[];
  qualityPreset: QualityPreset;
  quality: number | null;
  qualityMaxHeight: number | undefined;
  capAutoActif: boolean;
  /** Clé AFFICHÉE au sélecteur : le palier réellement servi, cap compris —
   *  « Originale » cochée pendant un cap mentait au menu. */
  qualityKeyEffective: QualityKey;
  /** Sélection MANUELLE du menu : désarme d'abord le cap (re-choisir
   *  « Originale » redevient possible et définitif pour cet item). */
  setQualityKeyManuel: (k: QualityKey) => void;
} {
  const { mediaSource, itemId, qualityKey, setQualityKey } = args;
  const client = useJellyfinClient();
  const { show } = useToast();
  const { t } = useTranslation("player");

  // Mesure amorcée dès le montage du lecteur (fire-and-forget, cache 10 min) :
  // sur un réseau local elle aboutit avant la première décision de flux.
  useEffect(() => { amorcerMesure(client); }, [client]);

  // Les paliers dépendent de la source : proposer un transcodage plus lourd
  // que l'original serait absurde (cf. construireEchelleQualite).
  const qualityPresets = useMemo(() => construireEchelleQualite(mediaSource), [mediaSource]);
  const qualityPreset = trouverPreset(qualityKey, qualityPresets);

  // Garde-fou : l'échelle étant calculée d'après la source, un palier proposé
  // sur un fichier peut disparaître sur le suivant. Sans ce repli, la clé
  // survivrait sans correspondance — sélecteur sans sélection visible, et un
  // débit rendu par `trouverPreset` qui ne serait plus celui affiché.
  useEffect(() => {
    if (!presetEstPropose(qualityKey, qualityPresets)) setQualityKey("original");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityPresets, qualityKey]);

  // Cap figé par item : photographié UNE fois, à l'arrivée de la source.
  const evalueRef = useRef<string | undefined>(undefined);
  const capRef = useRef<QualityPreset | null>(null);
  if (itemId !== evalueRef.current && mediaSource) {
    evalueRef.current = itemId;
    capRef.current = capAutomatique(mediaSource);
  }
  const capAuto = itemId === evalueRef.current ? capRef.current : null;

  // L'utilisateur qui touche le menu reprend la main : le cap se désarme pour
  // cet item, quel que soit son choix — y compris « Originale ».
  const desarmeRef = useRef<string | undefined>(undefined);
  const setQualityKeyManuel = useCallback((k: QualityKey) => {
    desarmeRef.current = itemId;
    setQualityKey(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, setQualityKey]);

  const capAutoActif = qualityKey === "original" && capAuto != null && desarmeRef.current !== itemId;
  const presetEffectif = capAutoActif && capAuto ? capAuto : qualityPreset;

  // Le dire UNE fois par item — le toast s'efface seul (4 s).
  const signaleRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (capAutoActif && signaleRef.current !== itemId) {
      signaleRef.current = itemId;
      show("info", t("qualityReduced"));
    }
  }, [capAutoActif, itemId, show, t]);

  return {
    qualityPresets,
    qualityPreset,
    quality: presetEffectif.bitrate,
    qualityMaxHeight: presetEffectif.height ?? undefined,
    capAutoActif,
    qualityKeyEffective: capAutoActif && capAuto ? capAuto.key : qualityKey,
    setQualityKeyManuel,
  };
}
