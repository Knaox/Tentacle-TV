import type { RelayedTrailerPlayback, RichTrailer, TrailerEntry } from "../trailers";

/** Une entrée du catalogue jouée en ligne (YouTube, Dailymotion) : par le relais du serveur. */
export type RelayedTrailerEntry = TrailerEntry & { playback: RelayedTrailerPlayback };

/**
 * Ce que lance le bouton « Bande-annonce » de la fiche.
 *
 * `local` : un fichier du serveur, lu dans le lecteur de l'app par son id.
 * `remote` : une vidéo YouTube — la modale du web, l'app YouTube ou le
 * navigateur du mobile, l'écran de bande-annonce des téléviseurs.
 * `relay` : une entrée du catalogue (YouTube ou Dailymotion), lue par le
 * lecteur complet, sans publicité — là seulement où la plateforme l'a.
 */
export type TrailerTarget =
  | { kind: "local"; itemId: string }
  | { kind: "remote"; trailer: RichTrailer }
  | { kind: "relay"; entry: RelayedTrailerEntry };

/**
 * Ce qu'une plateforme sait LIRE d'un catalogue : `local` (une bande-annonce
 * de Jellyfin, dans son lecteur), `youtube`, `dailymotion`. Lire Dailymotion,
 * c'est avoir le lecteur complet (relais du serveur) : ses vidéos en ligne,
 * YouTube compris, y passent toutes.
 *
 * | Plateforme                                  | playable                         |
 * |---------------------------------------------|----------------------------------|
 * | Web et bureau (lecteur complet)             | local, youtube, dailymotion      |
 * | Apple TV, Android TV, mobile, LG — d'ici leur phase | local, youtube           |
 */
export type TrailerPlayable = "local" | "youtube" | "dailymotion";

const youtubeUrl = (ytId: string) => `https://www.youtube.com/watch?v=${ytId}`;

/** Une entrée YouTube du catalogue, telle que la lisent les écrans d'avant le lecteur complet. */
function richTrailerOf(entry: TrailerEntry): RichTrailer | null {
  if (entry.playback.kind !== "youtube") return null;
  return { Url: youtubeUrl(entry.playback.ytId), Name: entry.name, type: entry.type === "teaser" ? "Teaser" : "Trailer" };
}

/**
 * Ce que lance le bouton d'après le CATALOGUE (déjà ordonné par le serveur :
 * la saison de l'épisode, la série, la langue du serveur d'abord) : la
 * première entrée que la plateforme sait lire. `null` : aucun bouton.
 */
export function catalogTrailerTarget(entries: readonly TrailerEntry[], playable: readonly TrailerPlayable[]): TrailerTarget | null {
  const relay = playable.includes("dailymotion");
  for (const entry of entries) {
    const { playback } = entry;
    if (playback.kind === "jellyfin") {
      if (playable.includes("local")) return { kind: "local", itemId: playback.itemId };
      continue;
    }
    if (!playable.includes(playback.kind)) continue;
    if (relay) return { kind: "relay", entry: entry as RelayedTrailerEntry };
    const trailer = richTrailerOf(entry);
    if (trailer) return { kind: "remote", trailer };
  }
  return null;
}

/** Les entrées YouTube du catalogue, dans son ordre, pour les écrans qui enchaînent des vidéos YouTube. */
export function catalogRemoteTrailers(entries: readonly TrailerEntry[]): RichTrailer[] {
  return entries.flatMap((entry) => {
    const trailer = richTrailerOf(entry);
    return trailer ? [trailer] : [];
  });
}

/**
 * La bande-annonce à lancer : la LOCALE d'abord (c'est celle du serveur, dans
 * la langue et la qualité que l'administrateur a choisies), sinon la première
 * distante — déjà triée par langue (`mergeTrailers`). `null` : aucun bouton.
 */
export function resolveTrailerTarget(
  local: ReadonlyArray<{ Id: string }> | undefined,
  remote: readonly RichTrailer[],
): TrailerTarget | null {
  const file = local?.[0];
  if (file) return { kind: "local", itemId: file.Id };
  const video = remote.find((trailer) => !!trailer.Url);
  return video ? { kind: "remote", trailer: video } : null;
}

/**
 * Le bouton existe-t-il ? Une cible résolue, ou une bande-annonce locale que
 * la fiche ANNONCE (`LocalTrailerCount`) avant que sa liste soit arrivée : le
 * bouton se pose alors d'emblée, sans décaler la page une fraction de seconde
 * plus tard.
 */
export function hasTrailer(target: TrailerTarget | null, item: { LocalTrailerCount?: number } | undefined): boolean {
  return target !== null || (item?.LocalTrailerCount ?? 0) > 0;
}
