import { useCallback, useEffect, useRef } from "react";
import { primeBitrateMeasure, cachedBitrate, useJellyfinClient } from "@tentacle-tv/api-client";
import { capForBitrate } from "@tentacle-tv/shared";
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
 *  - le cap est une PHOTOGRAPHIE par (item, session de flux) : prise quand la
 *    source est connue, re-prise à chaque RECONSTRUCTION de session (seek
 *    lointain re-remuxé, reload — startTicks bouge) — jamais en cours de
 *    lecture continue. Une lecture partie en Originale-remux parce que la
 *    mesure n'était pas prête bascule ainsi au premier seek, au lieu de ramer
 *    à vie. Mesure absente (serveur sans BitrateTest au proxy, échec réseau)
 *    → aucun cap, lecture comme avant.
 */
export function useTVAutoQualityCap(args: {
  mediaSource: MediaSource | undefined;
  itemId: string;
  qualityKey: QualityKey;
  /** Position de reload (useTVReloadState) : change à chaque reconstruction de
   *  session — c'est le moment sûr pour re-photographier le cap. */
  startTicks: number;
}): {
  active: boolean;
  key?: QualityKey;
  maxBitrate?: number;
  maxHeight?: number;
  maxWidth?: number;
  /** Choix MANUEL dans le menu (y compris re-choisir « Originale ») : le cap se
   *  désarme pour cet item — l'utilisateur a repris la main, on ne la reprend plus. */
  disarm: () => void;
} {
  const { mediaSource, itemId, qualityKey, startTicks } = args;
  const client = useJellyfinClient();

  // Filet : si l'accueil n'a pas déjà préchauffé la mesure, l'amorcer ici —
  // trop tard pour CETTE lecture (la décision de flux part immédiatement),
  // à temps pour les suivantes (et pour le premier seek re-remuxé).
  useEffect(() => { primeBitrateMeasure(client); }, [client]);

  // Photographie par (item, session) : re-prise quand startTicks bouge — un
  // seek re-remuxé ou un reload reconstruit le flux de toute façon, c'est le
  // seul moment où changer de palier ne coûte rien de plus.
  const sessionKey = `${itemId}|${startTicks}`;
  const evaluatedRef = useRef<string | undefined>(undefined);
  const capRef = useRef<QualityPreset | null>(null);
  if (sessionKey !== evaluatedRef.current && mediaSource) {
    evaluatedRef.current = sessionKey;
    capRef.current = capForBitrate(mediaSource, cachedBitrate());
    if (capRef.current) {
      plog("cap", `debit mesure ${(cachedBitrate() ?? 0) / 1e6 | 0} Mb/s < source → palier ${capRef.current.key} (${(capRef.current.bitrate ?? 0) / 1e6} Mb/s)`);
    }
  }
  const cap = sessionKey === evaluatedRef.current ? capRef.current : null;

  const disarmedRef = useRef<string | undefined>(undefined);
  const disarm = useCallback(() => { disarmedRef.current = itemId; }, [itemId]);

  const active = qualityKey === "original" && cap != null && disarmedRef.current !== itemId;
  if (!active || !cap) return { active: false, disarm };
  return {
    active: true,
    key: cap.key,
    maxBitrate: cap.bitrate ?? undefined,
    maxHeight: cap.height ?? undefined,
    maxWidth: cap.width ?? undefined,
    disarm,
  };
}
