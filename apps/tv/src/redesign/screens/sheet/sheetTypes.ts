import type { CardStatusKind } from "@tentacle-tv/shared";

/**
 * Ce que fait un picto du panneau : les actions du modèle partagé
 * (`cardActionEntries`, `externalCardActionEntries`), dans leur ordre, plus
 * celles propres au salon — « Plus d'infos » sur toute carte de la
 * bibliothèque, « Toutes les plateformes » sous un filtre actif. La note n'en
 * est pas une : elle a son échelle, au-dessus.
 */
export type SheetActionKind =
  | "play"
  | "request"
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
  /** La forme de la carte d'où vient le panneau — son image la rappelle. */
  shape: "poster" | "landscape";
}

export interface SheetRatingModel {
  /** La note posée, sur 10 ; `null` : aucune. */
  current: number | null;
  /** La note ou ce qu'elle vise se résout encore (la liste des notes, la
   *  série d'un épisode) : l'échelle attend, « … », rien ne s'y focalise. */
  pending?: boolean;
}
