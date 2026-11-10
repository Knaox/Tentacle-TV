/**
 * Octave — la part de l'EXTENSION dans l'import d'une playlist (points optionnels `importRead`, `importTracks` du
 * contrat `music`) : ses requêtes, son suivi, et l'envoi PAR LOTS (lot « pg », serveur 1.43.0). Recopié octet pour
 * octet dans le backend (`apps/backend/src/music/contract/`, test miroir) ; `musicImport.ts` en réexporte les types.
 *
 * LES LOTS. Une extension qui déclare `importBatches: true` (manifeste `music`, relayé par `/api/plugins/active`)
 * reçoit les absents d'un import en appels d'au plus `MUSIC_IMPORT_BATCH.size` titres, `MUSIC_IMPORT_BATCH.parallel`
 * en vol, dans N'IMPORTE QUEL ordre. Chaque appel porte `importId` (le même pour tout l'import), `total` (les absents
 * de TOUT l'import) et des `index` GLOBAUX (le rang dans la source). Ce que l'extension garantit :
 *  - UNE opération par (compte, `importId`) : chaque lot rend le MÊME `operationId` ;
 *  - idempotence par (`importId`, `index`) : un lot rejoué (relance après une coupure) ne pose rien deux fois ;
 *  - l'opération est complète quand elle tient `total` `index` distincts ; son `ImportTracksProgress.total` vaut
 *    `total` dès le premier lot, et `state` ne passe à `done` qu'une fois tout reçu ET traité ;
 *  - une réponse RAPIDE : aucune requête réseau par titre dans le chemin de l'appel (la résolution vient après, en
 *    fond) ; titres, artistes, album, durée et pochette DE LA SOURCE posés tout de suite.
 * Une extension qui ne déclare rien (d'avant) : UN appel, comme avant, jamais plus de `legacyCap` titres (le
 * plafond d'avant) ; le bilan dit les autres `extensionLimit`.
 */

import type { ImportAbsentTrack, MusicImportSource } from "./musicImport";
import type { ImportSkipped } from "./musicImportSkip";

export const MUSIC_IMPORT_BATCH = {
  /** Titres par appel au plus (≈ 200 Ko de JSON : loin de toute limite de corps). */
  size: 500,
  /** Appels en vol au plus, pour un import. */
  parallel: 3,
  /** Relances d'un lot que le RÉSEAU a fait échouer (jamais un refus de l'extension) avant de le dire perdu. */
  retries: 2,
  /** Une extension sans lots : au plus ce nombre d'absents, en UN appel (le plafond d'avant le lot « pg »). */
  legacyCap: 1_000,
} as const;

/** Les absents d'un import découpés en lots, dans l'ordre de la source (les `index` globaux sont gardés). */
export function importBatchesOf<T>(tracks: readonly T[], size: number = MUSIC_IMPORT_BATCH.size): T[][] {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let at = 0; at < tracks.length; at += step) out.push(tracks.slice(at, at + step));
  return out;
}

/** Refus de `importRead`, liste FERMÉE (le client les dit comme ceux du cœur). */
export type ImportReadRefusal = "unsupported" | "notFound" | "private" | "unavailable" | "tooLarge" | "budget";

/**
 * POST `<importTracks>` — les absents d'un import, pour la playlist que le cœur vient de créer au nom du compte.
 * Extension qui déclare `importBatches` (1.43.0, en tête de ce fichier) : PAR LOTS, chacun avec `importId` et `total`.
 */
export interface ImportTracksRequest {
  playlistId: string;
  source: MusicImportSource;
  tracks: ImportAbsentTrack[];
  /** L'import entier (l'identifiant du suivi du cœur) : tous ses lots le portent ; une opération par `importId`. */
  importId?: string;
  /** Le nombre d'absents de TOUT l'import (tous lots confondus) : l'opération est complète à `total` `index` distincts. */
  total?: number;
  /** Le nom et la pochette de la playlist chez la source (de quoi l'habiller avant toute résolution). */
  name?: string;
  artworkUrl?: string | null;
}

/** 202 — l'opération suivie ; `accepted` ≤ le nombre confié dans CET appel (elle peut en refuser d'emblée, quota). */
export interface ImportTracksAccepted {
  operationId: string;
  accepted: number;
}

/** GET `<importTracks>/<operationId>` — sondé tant que `running`. */
export interface ImportTracksProgress {
  operationId: string;
  state: "running" | "done" | "failed";
  total: number;
  /** Titres traités (trouvés + introuvables). */
  processed: number;
  /** Titres ENTRÉS dans la playlist (entrées `playlistAdd` en attente, jouables aussitôt). */
  added: number;
  /** Les `index` qu'elle n'a pas trouvés. */
  notFound: number[];
  /** Raison d'un `failed` ou d'un arrêt partiel (liste fermée `ExternalActionRefusal` du contrat `music`). */
  reason?: "quota" | "forbidden" | "unavailable" | "notFound" | "failed";
  /** Les titres non posés et leur motif (1.40.0 ; une extension d'avant : `notFound` seul). */
  skipped?: ImportSkipped[];
  /** Parmi `added`, ceux que le COMPTE avait déjà importés (ses fichiers) : pas « en cloud ». */
  own?: number;
}
