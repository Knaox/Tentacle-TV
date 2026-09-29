import type { RichTrailer } from "../trailers";

/**
 * Ce que lance le bouton « Bande-annonce » de la fiche.
 *
 * `local` : un fichier du serveur, lu dans le lecteur de l'app par son id.
 * `remote` : une vidéo YouTube — la modale du web, l'app YouTube ou le
 * navigateur du mobile, l'écran de bande-annonce des téléviseurs.
 */
export type TrailerTarget =
  | { kind: "local"; itemId: string }
  | { kind: "remote"; trailer: RichTrailer };

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
