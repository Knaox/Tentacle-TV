import { useEffect, useRef } from "react";
import { amorcerMesureDebit, debitEnCache, useJellyfinClient } from "@tentacle-tv/api-client";
import { capPourDebit } from "@tentacle-tv/shared";
import type { MediaSource, QualityKey, QualityPreset } from "@tentacle-tv/shared";
import { plog } from "../utils/playerDiag";

/**
 * Cap AUTOMATIQUE de qualité selon le débit MESURÉ (Apple TV + Android TV).
 *
 * Quand la connexion réelle (téléchargement témoin BitrateTest, cache 10 min)
 * ne porte pas le fichier, un palier de l'échelle remplace « Originale » —
 * le pipeline le traite alors exactement comme un choix de qualité (transcode
 * serveur au débit du palier). Deux règles produit :
 *  - un choix MANUEL de l'utilisateur prime toujours : le cap ne s'applique
 *    que si la qualité est restée sur « Originale » ;
 *  - le cap est une PHOTOGRAPHIE par item, prise quand la source est connue —
 *    jamais de renégociation en cours de lecture. Mesure absente (serveur sans
 *    BitrateTest au proxy, échec réseau) → aucun cap, lecture comme avant.
 */
export function useTVAutoQualityCap(args: {
  mediaSource: MediaSource | undefined;
  itemId: string;
  qualityKey: QualityKey;
}): { actif: boolean; maxBitrate?: number; maxHeight?: number; maxWidth?: number } {
  const { mediaSource, itemId, qualityKey } = args;
  const client = useJellyfinClient();

  // Filet : si l'accueil n'a pas déjà préchauffé la mesure, l'amorcer ici —
  // trop tard pour CETTE lecture (la décision de flux part immédiatement),
  // à temps pour les suivantes.
  useEffect(() => { amorcerMesureDebit(client); }, [client]);

  // Photographie par item, à l'arrivée de la source.
  const evalueRef = useRef<string | undefined>(undefined);
  const capRef = useRef<QualityPreset | null>(null);
  if (itemId !== evalueRef.current && mediaSource) {
    evalueRef.current = itemId;
    capRef.current = capPourDebit(mediaSource, debitEnCache());
    if (capRef.current) {
      plog("cap", `debit mesure ${(debitEnCache() ?? 0) / 1e6 | 0} Mb/s < source → palier ${capRef.current.key} (${(capRef.current.bitrate ?? 0) / 1e6} Mb/s)`);
    }
  }
  const cap = itemId === evalueRef.current ? capRef.current : null;

  const actif = qualityKey === "original" && cap != null;
  if (!actif || !cap) return { actif: false };
  return {
    actif: true,
    maxBitrate: cap.bitrate ?? undefined,
    maxHeight: cap.height ?? undefined,
    maxWidth: cap.width ?? undefined,
  };
}
