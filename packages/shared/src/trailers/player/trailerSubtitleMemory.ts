import { TRAILER_SUBTITLES_OFF } from "./trailerChoices";
import type { TrailerVersion } from "../trailerCatalog";

/**
 * Le sous-titre RETENU d'une bande-annonce à la suivante, sur ce téléviseur.
 * Un choix fait dans le panneau (« Désactivés » ou une langue) se garde ; à
 * l'ouverture d'une autre bande-annonce, la langue retenue est reprise si
 * elle y est offerte — la même (`fr-FR`), sinon la même langue de base
 * (`fr` pour `fr-CA`) — sinon rien. Jamais de sous-titres imposés : sans
 * choix retenu, ils restent désactivés. Module pur ; la plateforme lit et
 * écrit la valeur.
 *
 * Le lecteur du web et du bureau part, SANS choix retenu, sur la langue du
 * serveur (`trailerStartSubtitle`) ; les téléviseurs, sans rien.
 *
 * Un goût de la PERSONNE : rangé par compte (`tentacle_trailer_subtitle:<id>`),
 * chaque profil de la Famille garde le sien sur la même TV.
 */

/** Le préfixe de la clé de stockage — traversé par une chaîne : jamais renommé. */
export const TRAILER_SUBTITLE_KEY_PREFIX = "tentacle_trailer_subtitle:";

/** La clé du compte affiché. */
export function trailerSubtitleKey(userId: string): string {
  return `${TRAILER_SUBTITLE_KEY_PREFIX}${userId}`;
}

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

/**
 * Le sous-titre au LANCEMENT (web, bureau) :
 * - un choix retenu l'emporte, « Désactivés » compris (`trailerRememberedSubtitle`) ;
 * - sinon, la piste POSÉE dans la langue du serveur (celle de ses métadonnées,
 *   rendue par `resolve`) — sauf pour une bande-annonce déjà dans cette langue
 *   (`localized`, la VF d'un serveur français) ;
 * - jamais la reconnaissance vocale (`auto`) : elle transcrit la langue de la
 *   bande-annonce elle-même, donc rien d'utile à qui ne la parle pas.
 */
export function trailerStartSubtitle(
  tracks: readonly { lang: string; auto: boolean }[],
  remembered: string | null,
  context: { language?: string | null; version?: TrailerVersion },
): string | null {
  if (remembered) return trailerRememberedSubtitle(tracks, remembered);
  if (!context.language || context.version === "localized") return null;
  const wanted = base(context.language);
  return tracks.find((track) => !track.auto && base(track.lang) === wanted)?.lang ?? null;
}
