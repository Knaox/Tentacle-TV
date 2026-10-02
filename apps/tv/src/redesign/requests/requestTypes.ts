import type { ArrivalModel } from "./arrivalTypes";

/**
 * Ce que les vues des demandes en cours reçoivent — tout résolu par le
 * câblage (`redesignWiring/vigie/requestModels.ts`) : les mots dans la langue
 * de l'interface, les images, l'ordre. Les états sont ceux du contrat
 * `titles.mine` (`MyTitleState`, @tentacle-tv/shared), plus l'arrivée — un
 * état du client (`ArrivalModel`).
 */

export interface RequestItemModel {
  key: string;
  title: string;
  /** « 2011 · Saisons 2 et 3 » ; `null` : rien à en dire. */
  detail: string | null;
  imageUri: string | null;
  /** Où elle en est : l'état, la dernière lecture et son temps restant. */
  arrival: ArrivalModel;
  /** « En attente », « En cours »… */
  stateLabel: string;
  /** « Disponible » : le mot d'une demande qui quitte la liste en avançant (elle est arrivée). */
  arrivedLabel: string;
  /** « 42 % » à la dernière lecture, pour les lecteurs d'écran ; `null` sans avancement. */
  percentLabel: string | null;
}

export interface RequestsDockModel {
  /** « Mes demandes ». */
  label: string;
  /** « 3 demandes », « Rien en file d'attente » ; `null` tant que la liste n'est pas lue. */
  caption: string | null;
  /** Les affiches de l'aperçu, ce qui bouge d'abord — trois au plus ; chacune arrive façon Apple. */
  posters: Array<{ key: string; uri: string | null; arrival: ArrivalModel }>;
  /** Le nombre de demandes en cours (la pastille, à partir de deux). */
  count: number;
}
