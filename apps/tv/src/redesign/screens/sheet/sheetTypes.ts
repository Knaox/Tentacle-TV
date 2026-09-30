import type { CardStatusKind } from "@tentacle-tv/shared";

/**
 * Ce que fait une ligne de la feuille : les actions du modèle partagé
 * (`cardActionEntries`, `externalCardActionEntries`), dans leur ordre, plus
 * celles propres au salon — « Noter », qui ouvre l'échelle de la note, et
 * « Toutes les plateformes » sous un filtre actif.
 */
export type SheetActionKind =
  | "play"
  | "request"
  | "rate"
  | CardStatusKind
  | "details"
  | "dismiss"
  | "offline"
  | "providersAll";

export interface SheetActionModel {
  kind: SheetActionKind;
  /** Le libellé résolu : il dit ce que fera le geste (« Retirer de ma liste »). */
  label: string;
  /** Le complément de la lecture : l'épisode (S02E05), la position (12:34). */
  detail?: string | null;
  /** Une bascule posée : son glyphe se remplit. */
  active?: boolean;
}

export interface SheetHeaderModel {
  title: string;
  subtitle?: string | null;
  imageUri?: string;
  /** La forme de la carte d'où vient la feuille — son image la rappelle. */
  shape: "poster" | "landscape";
}

export interface SheetRatingModel {
  /** La note posée, sur 10 ; `null` : aucune. */
  current: number | null;
  /** Ce que note l'échelle se résout encore (la série d'un épisode) : la
   *  valeur s'affiche « … », OK ne note rien. */
  pending?: boolean;
}
