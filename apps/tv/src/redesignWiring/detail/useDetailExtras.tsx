import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "react-native";
import { useTranslation } from "react-i18next";
import { useFicheExtras, useItemsExtras, useJellyfinClient, type ItemTrailerOptions } from "@tentacle-tv/api-client";
import { ficheExtraTiles, sortTrailersByLang, type FicheExtraTile, type MediaItem, type TrailerTarget } from "@tentacle-tv/shared";
import type { ExtraModel } from "../../redesign/screens/detail/detailTypes";
import { localExtraUri } from "./detailImages";

/**
 * Les extras de la fiche, en UNE rangée : le carrousel du bureau
 * (`useFicheExtras`, `ficheExtraTiles`) — film ; série et toutes ses saisons ;
 * épisode, sa saison sinon le reste. Avec le catalogue du serveur, toutes ses
 * vidéos (TMDB, AlloCiné), lues par le relais ; sans lui, celles d'avant
 * (Jellyfin, TMDB). Le contexte — la saison — passe dans le sous-titre.
 *
 * Une vidéo YouTube retirée renvoie une vignette grise de 120 × 90 : mesurée
 * une fois par adresse, elle grise sa tuile (« Indisponible ») sans la retirer
 * — une tuile démontée sous le focus le laisserait orphelin.
 */

/**
 * Ce que les téléviseurs savent lire : l'écran de bande-annonce relaie
 * YouTube ET Dailymotion (AlloCiné) par le serveur. Le catalogue n'est suivi
 * que si le serveur le déclare (`trailers.catalog`) ; sinon, la règle d'avant.
 */
export const TV_TRAILER_PLATFORM: ItemTrailerOptions = { playable: ["local", "youtube", "dailymotion"], catalog: true };

/** Largeur de la vignette YouTube d'une vidéo retirée. */
const DEAD_THUMB_WIDTH = 120;
const thumbVerdicts = new Map<string, boolean>();

export interface DetailExtras {
  extras: ExtraModel[];
  /** Ce que lance une tuile : lecteur (local) ou bande-annonce (YouTube, Dailymotion). */
  targetOf: (id: string) => TrailerTarget | undefined;
}

/** Les vignettes YouTube grises (vidéo retirée) parmi ces tuiles. */
function useDeadThumbs(tiles: readonly FicheExtraTile[]): ReadonlySet<string> {
  const [dead, setDead] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let alive = true;
    const mark = (key: string) => {
      if (alive) setDead((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    };
    for (const tile of tiles) {
      if (!tile.youtubeId || !tile.thumbUrl) continue;
      const url = tile.thumbUrl;
      const known = thumbVerdicts.get(url);
      if (known !== undefined) {
        if (known) mark(tile.key);
        continue;
      }
      Image.getSize(
        url,
        (width) => {
          thumbVerdicts.set(url, width <= DEAD_THUMB_WIDTH);
          if (width <= DEAD_THUMB_WIDTH) mark(tile.key);
        },
        () => undefined,
      );
    }
    return () => {
      alive = false;
    };
  }, [tiles]);
  return dead;
}

/**
 * Les extras locaux, STABLES d'un rendu à l'autre : `useItemsExtras` rend une
 * liste neuve à chaque rendu — sans cette garde, les tuiles, la rangée et la
 * mesure des vignettes se recalculaient à chaque rendu de la fiche.
 */
function useStableLocalExtras(owners: Parameters<typeof useItemsExtras>[0]) {
  const { local, ownerOf } = useItemsExtras(owners);
  const signature = local.map((extra) => `${extra.Id}:${ownerOf.get(extra.Id) ?? ""}:${extra.Name ?? ""}`).join("|");
  const kept = useRef({ signature, local, ownerOf });
  if (kept.current.signature !== signature) kept.current = { signature, local, ownerOf };
  return kept.current;
}

/** Un visage vide tant que la fiche se charge : les hooks s'appellent toujours. */
const PLACEHOLDER = { Id: "", Name: "", Type: "Movie" } as MediaItem;
const NO_OWNERS: MediaItem[] = [];

export function useDetailExtras(item: MediaItem | undefined, parentSeries: MediaItem | undefined, lang: string): DetailExtras {
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  const fiche = useFicheExtras(item ?? PLACEHOLDER, parentSeries, lang, TV_TRAILER_PLATFORM);
  const { local, ownerOf } = useStableLocalExtras(item ? fiche.owners : NO_OWNERS);
  const tiles = useMemo(
    () => (item
      ? ficheExtraTiles(t, { local, ownerOf, remote: sortTrailersByLang(fiche.remote, lang), catalog: fiche.catalog, seasonNames: fiche.seasonNames })
      : []),
    [item, t, local, ownerOf, fiche.remote, fiche.catalog, fiche.seasonNames, lang],
  );

  const dead = useDeadThumbs(tiles);
  const extras = useMemo<ExtraModel[]>(
    () =>
      tiles.map((tile) => ({
        id: tile.key,
        title: tile.title,
        subtitle: tile.subtitle || undefined,
        imageUri: tile.target.kind === "local" ? localExtraUri(client, tile.target.itemId) : tile.thumbUrl ?? undefined,
        unavailable: dead.has(tile.key),
      })),
    [tiles, dead, client],
  );
  const targetOf = useCallback((id: string) => tiles.find((tile) => tile.key === id)?.target, [tiles]);
  return { extras, targetOf };
}
