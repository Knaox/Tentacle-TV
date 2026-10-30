/**
 * Octave — ce que l'interface montre de la musique gardée, règle PURE
 * (`keepRules.test.ts`). Une porte pour tous les boutons.
 *
 * - Bureau seulement (la coquille sait garder la musique), et un serveur qui
 *   déclare `offline.music` : sinon aucun bouton — un serveur d'avant, une
 *   extension d'avant, le web : comportement d'avant, sans erreur.
 * - Le hors ligne appartient au COMPTE DE L'APPAREIL (`offlineSurfaceOf`, la
 *   règle des films) : une session de profil n'en voit rien ; un compte à qui le
 *   serveur refuse `keepOffline` (`EnableContentDownloading` compris) non plus.
 * - Un titre HORS bibliothèque demande EN PLUS que l'extension sache le fournir
 *   (route `offline` de son contrat) et le permette au compte (`keepOffline` de
 *   ses droits). Les serveurs refusent de toute façon : l'interface ne fait que
 *   cacher.
 * - Un titre INDISPONIBLE (`isTrackUnavailable`, lot « fl ») ne se garde jamais :
 *   ni demandé, ni tenté par la tenue à jour d'une playlist gardée — aucune erreur
 *   de transfert à cause de lui. Redevenu lisible, la tenue à jour le prend.
 */

import { offlineSurfaceOf, type KeepRight } from "../rights/offlineOwner";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { isTrackUnavailable } from "@tentacle-tv/shared/octave";

export interface MusicOfflineInputs {
  /** La coquille garde la musique (`downloads_music_list`). */
  native: boolean;
  /** Le serveur déclare `offline.music`. */
  capability: boolean;
  profileSession: boolean;
  keepRight: KeepRight;
  /** Le compte a déjà de la musique sur l'appareil. */
  hasContent: boolean;
  /** L'extension de musique, si elle sait fournir un titre à garder ; `null` sans. */
  providerId: string | null;
  /** Ses droits pour ce compte : `keepOffline`, `null` tant qu'on ne sait pas. */
  providerKeep: boolean | null;
}

export interface MusicOfflineSurface {
  /** Montrer quoi que ce soit : marques, vue « Sur cet appareil », retrait. */
  visible: boolean;
  /** Proposer « Garder hors ligne » pour un titre de la bibliothèque. */
  library: boolean;
  /** … et pour un titre de CETTE extension. */
  externalFrom: string | null;
}

export const NO_MUSIC_OFFLINE: MusicOfflineSurface = { visible: false, library: false, externalFrom: null };

export function musicOfflineSurface(input: MusicOfflineInputs): MusicOfflineSurface {
  if (!input.native) return NO_MUSIC_OFFLINE;
  const surface = offlineSurfaceOf({
    profileSession: input.profileSession,
    keepRight: input.keepRight,
    engineCanKeep: input.capability,
    hasContent: input.hasContent,
  });
  return {
    visible: surface.visible,
    library: surface.canKeep,
    externalFrom: surface.canKeep && input.providerId !== null && input.providerKeep === true ? input.providerId : null,
  };
}

/** Ce titre peut-il être gardé ? (La bibliothèque, ou un titre de l'extension qui le permet.) */
export function canKeepTrack(track: MusicTrack, surface: MusicOfflineSurface): boolean {
  if (isTrackUnavailable(track)) return false;
  if (track.jellyfinId && track.availability === "library") return surface.library;
  return surface.externalFrom !== null && track.external?.pluginId === surface.externalFrom;
}
