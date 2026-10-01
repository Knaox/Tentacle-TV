/**
 * Ce que les vues des demandes en cours reçoivent — tout résolu par le
 * câblage (`redesignWiring/vigie/requestModels.ts`) : les mots dans la langue
 * de l'interface, les images, l'ordre. Les états sont ceux du contrat
 * `titles.mine` (`MyTitleState`, @tentacle-tv/shared).
 */

export type RequestStateKind = "pending" | "arriving" | "importing" | "blocked";

export interface RequestItemModel {
  key: string;
  title: string;
  /** « 2011 · Saisons 2 et 3 » ; `null` : rien à en dire. */
  detail: string | null;
  imageUri: string | null;
  state: RequestStateKind;
  /** « En attente », « En cours »… */
  stateLabel: string;
  /** 0 à 100 quand le titre arrive et que l'avancement se sait. */
  percent: number | null;
  /** « 42 % » ; `null` sans avancement. */
  percentLabel: string | null;
}

export interface RequestsDockModel {
  /** « Mes demandes ». */
  label: string;
  /** « 3 demandes », « Rien en file d'attente » ; `null` tant que la liste n'est pas lue. */
  caption: string | null;
  /** Les affiches de l'aperçu, la plus récente d'abord — trois au plus. */
  posters: Array<{ key: string; uri: string | null }>;
  /** Le nombre de demandes en cours (la pastille, à partir de deux). */
  count: number;
}
