/**
 * Octave (mobile) — l'entrée « Votre musique sur cet appareil » du hors ligne de
 * Tentacle, règle PURE (`musicEntryRule.test.ts`). Rien sans le droit :
 *   - la porte du hors ligne d'Octave (`musicOfflineSurface` : compte de
 *     l'appareil, `keepOffline` du compte — refusé, rien, même avec de la musique gardée) ;
 *   - au moins un titre gardé EN ENTIER ;
 *   - Octave n'existe pas pour ce compte sur ce serveur (capacité `music.library`
 *     absente, « Accès à Octave » retiré, réponse ÉTABLIE en ligne — règle partagée
 *     `octaveAbsenceEstablished`) : rien. Hors ligne, ou `/api/config` sans réponse,
 *     le serveur ne peut rien dire : la musique gardée le dit (comme le bureau).
 */

import { octaveAbsenceEstablished } from "@tentacle-tv/shared/octave/mode";

export interface MusicEntryInput {
  /** `musicOfflineSurface(...).visible`. */
  surfaceVisible: boolean;
  /** Titres gardés en entier ; `null` : pas encore lu. */
  playable: number | null;
  online: boolean;
  octave: { available: boolean; settled: boolean };
  /** Le statut de la musique est en erreur (panne) : jamais une absence. */
  statusFailed: boolean;
  /** `/api/config` a RÉPONDU : fini en échec (démarrage sans réseau), ses capacités vides ne prouvent rien. */
  configKnown: boolean;
}

export function musicEntryVisible(input: MusicEntryInput): boolean {
  if (!input.surfaceVisible || !input.playable) return false;
  const facts = { fresh: input.octave, failed: input.statusFailed, configKnown: input.configKnown, offline: !input.online };
  return !octaveAbsenceEstablished(facts);
}
