/**
 * Octave (mobile) — quelles lignes des Réglages d'Octave EXISTENT, d'après les droits du serveur (règle 15 du lot :
 * une ligne dont le droit manque n'existe pas, comme dans le catalogue des réglages). Pur, testé.
 *
 * - La page entière : seulement si Octave est disponible (`useOctaveAvailability` : serveur qui déclare
 *   `music.library` — 1.40.0 —, compte avec la musique et le droit « Accès à Octave »). La coquille la garde
 *   déjà (`OctaveGate`) ; la page se garde elle-même pour tout autre montage.
 * - « Tenir à jour les playlists gardées » : la règle du bureau (`keepRules.ts` › `library`) — le serveur déclare
 *   `offline.music`, le compte de l'appareil (jamais un profil) peut garder (`offlineSurfaceOf` › `canKeep` :
 *   droit `keepOffline` accordé, ou serveur d'avant ; ni refusé ni encore inconnu).
 */

import { offlineSurfaceOf, type KeepRight } from "@tentacle-tv/offline-core";

export interface AutoSyncRowInput {
  /** Le serveur déclare `offline.music`. */
  capable: boolean;
  profileSession: boolean;
  keepRight: KeepRight;
}

export function autoSyncRowShown(input: AutoSyncRowInput): boolean {
  if (!input.capable) return false;
  return offlineSurfaceOf({ profileSession: input.profileSession, keepRight: input.keepRight, engineCanKeep: true, hasContent: false }).canKeep;
}
