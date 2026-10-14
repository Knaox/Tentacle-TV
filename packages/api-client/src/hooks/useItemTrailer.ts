import { useMemo } from "react";
import {
  catalogRemoteTrailers, catalogTrailerTarget, hasTrailer, resolveTrailerTarget, type MediaItem, type RichTrailer,
  type TrailerEntry, type TrailerPlayable, type TrailerTarget,
} from "@tentacle-tv/shared";
import { useTrailerCatalog } from "../trailers/useTrailerCatalog";
import { useItemExtras, type ExtrasOwner } from "./useItemExtras";
import { useServerCapabilities } from "./useServerCapabilities";
import { useRemoteTrailersState, type RemoteTrailersOwner } from "./useRemoteTrailers";

export interface ItemTrailer {
  /** Ce que lance le bouton : la première bande-annonce que la plateforme sait lire. */
  target: TrailerTarget | null;
  /** Le bouton existe — y compris quand la fiche annonce une locale pas encore listée. */
  visible: boolean;
  /** Les vidéos YouTube, dans l'ordre : les écrans d'avant le lecteur complet les enchaînent. */
  remote: RichTrailer[];
  /** Tout le catalogue, dans l'ordre du serveur (vide sans la capacité `trailers.catalog`). */
  entries: TrailerEntry[];
  /**
   * Les listes ont répondu (ou ne sont pas demandées) : l'absence de
   * bande-annonce est alors un fait, pas une attente.
   */
  settled: boolean;
}

/**
 * Ce qu'une plateforme déclare : ce qu'elle sait LIRE (`TrailerPlayable`), et
 * si elle suit déjà le catalogue du serveur. Le typage oblige chacune à le
 * dire ; voir `TRAILER_PLATFORM_LEGACY` pour celles dont la phase n'est pas
 * venue.
 */
export interface ItemTrailerOptions {
  playable: readonly TrailerPlayable[];
  /** Suivre `/api/trailers/catalog` quand le serveur le déclare (sinon : la règle d'avant). */
  catalog: boolean;
}

/**
 * Apple TV, Android TV, mobile et LG, d'ici leur phase : la règle d'avant —
 * la bande-annonce locale, sinon la première vidéo YouTube de Jellyfin et de
 * TMDB —, rien ne change pour elles.
 */
export const TRAILER_PLATFORM_LEGACY: ItemTrailerOptions = { playable: ["local", "youtube"], catalog: false };

export type ItemTrailerOwner = ExtrasOwner & RemoteTrailersOwner & Pick<MediaItem, "Type">;

const NO_ENTRIES: TrailerEntry[] = [];

/**
 * Le bouton « Bande-annonce » d'une fiche, sur toutes les plateformes.
 *
 * Avec le catalogue (capacité `trailers.catalog`, plateforme qui le suit) :
 * la première entrée que la plateforme sait lire, dans l'ordre du SERVEUR —
 * un épisode et une saison ont donc LEUR bouton (leur saison, sinon une
 * autre, sinon la série). Sans : la bande-annonce LOCALE d'abord (lue dans le
 * lecteur de l'app), sinon la première distante. Pas de bouton quand il n'y a
 * rien à lire.
 */
export function useItemTrailer(item: ItemTrailerOwner | undefined, lang: string | undefined, options: ItemTrailerOptions): ItemTrailer {
  const { capabilities, known } = useServerCapabilities();
  const useCatalog = options.catalog && capabilities.has("trailers.catalog");
  const catalogState = useTrailerCatalog(item, lang, { enabled: useCatalog });
  const { trailers: local, settled: localSettled } = useItemExtras(item);
  // L'ancienne liste distante n'est demandée qu'une fois le serveur connu, et sans le catalogue.
  const legacy = useRemoteTrailersState(known && !useCatalog ? item : undefined, lang);
  const { playable } = options;

  const entries = (useCatalog && catalogState.catalog?.entries) || NO_ENTRIES;
  const settled = useCatalog ? catalogState.settled && localSettled : known && localSettled && legacy.settled;
  return useMemo(() => {
    if (useCatalog) {
      // Une locale annoncée, pas encore au catalogue (réponse en route) : elle d'abord, comme avant.
      const target = catalogTrailerTarget(entries, playable)
        ?? (playable.includes("local") ? resolveTrailerTarget(local, []) : null);
      return { target, visible: hasTrailer(target, item), remote: catalogRemoteTrailers(entries), entries, settled };
    }
    const target = resolveTrailerTarget(playable.includes("local") ? local : [], legacy.trailers);
    return { target, visible: hasTrailer(target, item), remote: legacy.trailers, entries: NO_ENTRIES, settled };
  }, [useCatalog, entries, playable, local, legacy.trailers, item, settled]);
}
