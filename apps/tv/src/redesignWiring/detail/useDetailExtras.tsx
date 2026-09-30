import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Image } from "react-native";
import { useJellyfinClient, useRemoteTrailers, useSeasons } from "@tentacle-tv/api-client";
import { seasonHasExtras, type ExtraEntry, type MediaItem, type RichTrailer } from "@tentacle-tv/shared";
import { useExtraEntries } from "../../components/detail/useExtraEntries";
import type { ExtraModel } from "../../redesign/screens/detail/detailTypes";
import { localExtraUri } from "./detailImages";

/**
 * Les extras de la fiche, en UNE rangée : ceux du titre, puis ceux de la
 * série d'un épisode, puis ceux de chaque saison qui en a (les compteurs de
 * la liste des saisons : aucune requête vide). Le contexte — la série, la
 * saison — passe dans le sous-titre de la tuile.
 *
 * Une saison, ce sont des hooks : chacune a son « capteur » (un composant qui
 * ne rend rien) qui remonte ses tuiles. Rendre `probes` dans l'écran.
 *
 * Une vidéo YouTube retirée renvoie une vignette grise de 120 × 90 : mesurée
 * une fois par adresse, elle grise sa tuile (« Indisponible ») sans la retirer
 * — une tuile démontée sous le focus le laisserait orphelin.
 */

const NO_TRAILERS: RichTrailer[] = [];
/** Largeur de la vignette YouTube d'une vidéo retirée. */
const DEAD_THUMB_WIDTH = 120;
const thumbVerdicts = new Map<string, boolean>();

interface Sourced {
  entry: ExtraEntry;
  /** « Saison 2 », le nom de la série : d'où vient la tuile, hors titre ouvert. */
  context: string | null;
}

export interface DetailExtras {
  extras: ExtraModel[];
  /** L'extra d'une tuile : lecteur (local) ou bande-annonce (YouTube). */
  entryOf: (id: string) => ExtraEntry | undefined;
  /** Les capteurs des saisons, à rendre dans l'écran (ils ne dessinent rien). */
  probes: ReactNode;
}

function SeasonProbe({ season, onEntries }: { season: MediaItem; onEntries: (seasonId: string, entries: ExtraEntry[]) => void }) {
  const entries = useExtraEntries(season, season.RemoteTrailers ?? NO_TRAILERS);
  useEffect(() => onEntries(season.Id, entries), [season.Id, entries, onEntries]);
  return null;
}

/** Les vignettes YouTube grises (vidéo retirée) parmi ces tuiles. */
function useDeadThumbs(sourced: Sourced[]): ReadonlySet<string> {
  const [dead, setDead] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let alive = true;
    const mark = (key: string) => {
      if (alive) setDead((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    };
    for (const { entry } of sourced) {
      if (entry.source !== "remote" || !entry.youtubeId || !entry.thumbUrl) continue;
      const url = entry.thumbUrl;
      const known = thumbVerdicts.get(url);
      if (known !== undefined) {
        if (known) mark(entry.key);
        continue;
      }
      Image.getSize(
        url,
        (width) => {
          thumbVerdicts.set(url, width <= DEAD_THUMB_WIDTH);
          if (width <= DEAD_THUMB_WIDTH) mark(entry.key);
        },
        () => undefined,
      );
    }
    return () => {
      alive = false;
    };
  }, [sourced]);
  return dead;
}

export function useDetailExtras(item: MediaItem | undefined, parentSeries: MediaItem | undefined, lang: string): DetailExtras {
  const client = useJellyfinClient();
  const seriesOfEpisode = item?.Type === "Episode" ? parentSeries : undefined;
  const series = item?.Type === "Series" ? item : seriesOfEpisode;

  const ownRemote = useRemoteTrailers(item, lang);
  const own = useExtraEntries(item, ownRemote);
  const seriesRemote = useRemoteTrailers(seriesOfEpisode, lang);
  const ofSeries = useExtraEntries(seriesOfEpisode, seriesOfEpisode ? seriesRemote : NO_TRAILERS);
  const { data: seasons } = useSeasons(series?.Id);
  const withExtras = useMemo(() => seasons?.filter(seasonHasExtras) ?? [], [seasons]);

  const [bySeason, setBySeason] = useState<Readonly<Record<string, ExtraEntry[]>>>({});
  const report = useCallback((seasonId: string, entries: ExtraEntry[]) => {
    setBySeason((prev) => (prev[seasonId] === entries ? prev : { ...prev, [seasonId]: entries }));
  }, []);

  const sourced = useMemo(() => {
    const all: Sourced[] = [];
    const seen = new Set<string>();
    const push = (entries: ExtraEntry[], context: string | null) => {
      for (const entry of entries) {
        if (seen.has(entry.key)) continue;
        seen.add(entry.key);
        all.push({ entry, context });
      }
    };
    push(own, null);
    push(ofSeries, seriesOfEpisode?.Name ?? null);
    for (const season of withExtras) push(bySeason[season.Id] ?? [], season.Name ?? null);
    return all;
  }, [own, ofSeries, seriesOfEpisode?.Name, withExtras, bySeason]);

  const dead = useDeadThumbs(sourced);
  const extras = useMemo<ExtraModel[]>(
    () =>
      sourced.map(({ entry, context }) => ({
        id: entry.key,
        title: entry.title,
        subtitle: [context, entry.subtitle].filter(Boolean).join(" · ") || undefined,
        imageUri: entry.source === "local" ? localExtraUri(client, entry.itemId) : entry.thumbUrl ?? undefined,
        unavailable: dead.has(entry.key),
      })),
    [sourced, dead, client],
  );
  const entryOf = useCallback((id: string) => sourced.find(({ entry }) => entry.key === id)?.entry, [sourced]);
  const probes = withExtras.map((season) => <SeasonProbe key={season.Id} season={season} onEntries={report} />);

  return { extras, entryOf, probes };
}
