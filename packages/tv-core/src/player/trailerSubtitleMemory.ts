import { TRAILER_SUBTITLES_OFF } from "./trailerPanels";

/**
 * Le sous-titre RETENU d'une bande-annonce à la suivante, sur ce téléviseur.
 * Un choix fait dans le panneau (« Désactivés » ou une langue) se garde ; à
 * l'ouverture d'une autre bande-annonce, la langue retenue est reprise si
 * elle y est offerte — la même (`fr-FR`), sinon la même langue de base
 * (`fr` pour `fr-CA`) — sinon rien. Jamais de sous-titres imposés : sans
 * choix retenu, ils restent désactivés. Module pur ; la plateforme lit et
 * écrit la valeur.
 */

/** Ce qui se garde : la clé d'option choisie (`off`, ou la langue d'une piste). */
export function trailerSubtitleMemoryOf(optionKey: string): string {
  return optionKey;
}

const base = (lang: string) => lang.toLowerCase().split(/[-_]/)[0];

/**
 * La piste à reprendre (sa langue, l'identifiant de tv-core
 * `trailerSubtitleOptions`), ou `null` : désactivés.
 */
export function trailerRememberedSubtitle(tracks: readonly { lang: string }[], remembered: string | null): string | null {
  if (!remembered || remembered === TRAILER_SUBTITLES_OFF) return null;
  const wanted = remembered.toLowerCase();
  const exact = tracks.find((track) => track.lang.toLowerCase() === wanted);
  if (exact) return exact.lang;
  return tracks.find((track) => base(track.lang) === base(wanted))?.lang ?? null;
}
