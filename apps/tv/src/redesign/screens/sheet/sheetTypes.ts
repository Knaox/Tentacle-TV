import type { SheetActionKind } from "@tentacle-tv/tv-core";
import type { ArrivalModel } from "../../requests/arrivalTypes";

/**
 * Ce que fait un picto du panneau : les actions du modèle partagé, dans leur
 * ordre, plus celles propres au salon — « Plus d'infos » sur toute carte de
 * la bibliothèque, « Toutes les plateformes » sous un filtre actif (tv-core
 * `cards/sheetActions`). La note n'en est pas une : elle a son échelle,
 * au-dessus.
 */
export type { SheetActionKind } from "@tentacle-tv/tv-core";

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
  /** Un titre que le compte a demandé : son affiche arrive comme sur sa carte
   *  (grise, puis sa couleur, le camembert au centre), et la ligne de
   *  contexte y ajoute l'avancement à l'instant. */
  arrival?: ArrivalModel;
}

export interface SheetRatingModel {
  /** La note posée, sur 10 ; `null` : aucune. */
  current: number | null;
  /** La note ou ce qu'elle vise se résout encore (la liste des notes, la
   *  série d'un épisode) : l'échelle attend, « … », rien ne s'y focalise. */
  pending?: boolean;
}
