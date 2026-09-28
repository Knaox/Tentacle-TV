/**
 * Le contrat de `GET /api/sagas/:collectionId` : la saga TMDB d'un film
 * (« Harry Potter - Saga ») et les titres de la bibliothèque qui en font
 * partie, pour le compte qui demande.
 *
 * MIROIR : ce fichier est recopié octet pour octet dans
 * `apps/backend/src/saga/sagaTypes.ts` (le backend ne dépend pas de
 * `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/). On le
 * modifie ICI, puis :
 *
 *   cp packages/shared/src/saga/sagaTypes.ts apps/backend/src/saga/
 *
 * `sagaMirror.test.ts` (backend) refuse toute divergence. Aucun import : le
 * fichier doit compiler seul des deux côtés.
 */

/** Un volet de la saga, tel que TMDB le décrit. */
export interface SagaPart {
  /** Identifiant TMDB du FILM — pas celui de la saga. */
  tmdbId: number;
  title: string;
  /** « AAAA-MM-JJ » ; null tant que TMDB n'annonce pas de date. */
  releaseDate: string | null;
}

/** La saga TMDB : son nom dans la langue demandée et ses volets, dans l'ordre de sortie. */
export interface SagaInfo {
  collectionId: number;
  name: string;
  parts: SagaPart[];
}

/**
 * Un titre de la bibliothèque rattaché à la saga — l'identifiant seul : les
 * cartes relisent l'item chez Jellyfin, avec l'état « vu » du compte.
 */
export interface SagaMember {
  itemId: string;
  /** Identifiant TMDB du film, s'il est connu : c'est lui qui place le titre dans la saga. */
  tmdbId: number | null;
}

export interface SagaResponse {
  collectionId: number;
  /** null : TMDB non configuré ou muet — la rangée garde alors un titre générique. */
  saga: SagaInfo | null;
  /** Les titres que CE compte peut voir — jamais ceux d'une bibliothèque qui lui est fermée. */
  members: SagaMember[];
}

/**
 * L'ordre d'une saga : la date de sortie. Un volet sans date (annoncé) passe
 * après les autres, dans l'ordre où TMDB les donne — TMDB, lui, ne trie pas
 * ses `parts` (« Le Prisonnier d'Azkaban » y arrive cinquième).
 */
export function sortSagaParts(parts: readonly SagaPart[]): SagaPart[] {
  return parts
    .map((part, index) => ({ part, index }))
    .sort((a, b) => {
      const left = a.part.releaseDate;
      const right = b.part.releaseDate;
      if (left !== null && right !== null && left !== right) return left < right ? -1 : 1;
      if (left === null && right !== null) return 1;
      if (left !== null && right === null) return -1;
      return a.index - b.index;
    })
    .map(({ part }) => part);
}
