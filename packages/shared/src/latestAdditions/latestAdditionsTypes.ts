/**
 * Ce qu'une carte REGROUPÉE des « Derniers ajouts » apporte de neuf.
 *
 * Dans la rangée « Derniers ajouts » d'une bibliothèque, le serveur regroupe
 * les épisodes et les saisons récents d'une même série en UNE carte : la série
 * elle-même (son `BaseItemDto` Jellyfin), à la place de son ajout le plus
 * récent. Il y joint ce champ, `LatestAdditions`, de façon ADDITIVE : un client
 * qui l'ignore affiche simplement la série.
 *
 * MIROIR : ce fichier est recopié octet pour octet dans
 * `apps/backend/src/latestAdditions/latestAdditionsTypes.ts` (le backend ne
 * dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans
 * packages/). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/latestAdditions/latestAdditionsTypes.ts apps/backend/src/latestAdditions/
 *
 * `latestAdditionsMirror.test.ts` (backend) refuse toute divergence. Aucun
 * import : le fichier doit compiler seul des deux côtés.
 */

/** Le champ joint à la série d'une carte regroupée (`MediaItem.LatestAdditions`). */
export interface LatestAdditions {
  /**
   * Les épisodes du groupe : ceux de la série arrivés dans le temps que couvre
   * la rangée. 0 quand seul un dossier (saison, série) est arrivé.
   */
  EpisodeCount: number;
  /** Les saisons concernées, par numéro croissant (0 : les spéciaux). */
  SeasonNumbers: number[];
  /**
   * Les saisons arrivées ELLES-MÊMES — leur dossier est nouveau, pas seulement
   * des épisodes — avec le dernier ajout du groupe (dans les 24 h qui le
   * précèdent), par numéro croissant. Jamais les spéciaux.
   */
  NewSeasonNumbers: number[];
  /** La série elle-même est arrivée avec le dernier ajout du groupe (même fenêtre). */
  NewSeries: boolean;
  /** La date (ISO 8601) de l'ajout le plus récent du groupe — celle qui place la carte. */
  LatestDate: string | null;
  /** La saison de l'ajout le plus récent : la fiche de la série s'ouvre dessus. */
  LatestSeasonId: string | null;
  /** Son numéro (0 : les spéciaux). */
  LatestSeasonNumber: number | null;
}
