/**
 * Octave — les MOTIFS d'un titre importé qui n'entre pas dans la playlist (le bilan de fin d'import, Damien 29/10 :
 * « X sur N titres », et pour chaque titre non importé, POURQUOI en mots simples). Contrat partagé par le cœur,
 * l'extension qui prend les absents et les clients. Recopié octet pour octet dans `apps/backend/src/music/contract/`.
 */

/**
 * POURQUOI un titre de la source n'est pas dans la playlist — liste FERMÉE, partagée par le cœur, l'extension et les
 * clients (qui ont leurs mots pour chacun : jamais un message brut). Une clé ne se renomme jamais (elle traverse le réseau).
 */
export type ImportSkipReason =
  /** Aucune source ne l'a (ni la bibliothèque, ni l'extension). */
  | "notFound"
  /** La source le réserve à d'autres pays. */
  | "region"
  /** La source refuse de le jouer (sans dire pourquoi). */
  | "sourceRefused"
  /** Déjà dans la playlist (deux fois dans la source, ou un import précédent). */
  | "duplicate"
  /** Le compte n'a pas le droit d'ajouter des titres hors bibliothèque. */
  | "notAllowed"
  /** La limite du jour du compte est atteinte. */
  | "quota"
  /** L'extension n'a pas répondu, ou a échoué. */
  | "unavailable"
  /** Le serveur n'a aucune extension qui prenne les titres hors bibliothèque. */
  | "noExtension";

export const IMPORT_SKIP_REASONS: readonly ImportSkipReason[] = ["notFound", "region", "sourceRefused", "duplicate", "notAllowed", "quota", "unavailable", "noExtension"];

export function isImportSkipReason(value: unknown): value is ImportSkipReason {
  return typeof value === "string" && (IMPORT_SKIP_REASONS as readonly string[]).includes(value);
}

/** Un titre que l'extension n'a PAS posé, et pourquoi (`ImportTracksProgress.skipped`). */
export interface ImportSkipped {
  index: number;
  reason: ImportSkipReason;
}
