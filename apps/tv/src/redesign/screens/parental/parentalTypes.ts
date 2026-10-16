import type { FamilyProfileColor } from "@tentacle-tv/shared";
import type { IconName } from "../../icons/Icon";

/**
 * Le contrat du CONTRÔLE PARENTAL simplifié (Apple TV, Android TV) : l'intégration
 * résout tout ce qui dépend du serveur et des capacités ; la vue rend, traduit ses
 * libellés fixes, et renvoie les gestes. Une section absente (`null`) n'est pas
 * montrée : un serveur qui ne sait pas la régler n'en voit rien.
 */

/** Une ligne de l'âge maximal (liste à choix unique). */
export interface ParentalAgeOptionView {
  /** La clé du palier (tv-core `ParentalAgeChoice.key`, ou `custom`). */
  key: string;
  label: string;
  /** Les noms d'une note réglée ailleurs (« 18 », « PG-13 »). */
  detail?: string;
  selected: boolean;
}

export interface ParentalAgeView {
  options: ParentalAgeOptionView[];
  /** Ce qui passe aujourd'hui, en une phrase (« Les titres jusqu'à 12 ans. »). */
  summary: string;
  /** Le plafond plus strict que le palier retenu : Jellyfin appliquera le plafond. */
  ceilingNote: string | null;
}

export interface ParentalLibraryView {
  id: string;
  name: string;
  icon: IconName;
  checked: boolean;
}

export interface ParentalLibrariesView {
  rows: ParentalLibraryView[];
  /** « Toutes », « 2 sur 4 ». */
  summary: string;
}

export interface ParentalNotice {
  text: string;
  tone: "progress" | "success" | "error";
}

export type ParentalViewModel =
  | { kind: "loading" }
  | { kind: "error"; message: string; retry: boolean }
  | {
      kind: "ready";
      name: string;
      color: FamilyProfileColor | null;
      avatarUri?: string;
      /** « Invité », « Membre de la famille ». */
      role: string;
      age: ParentalAgeView | null;
      libraries: ParentalLibrariesView | null;
      notice: ParentalNotice | null;
    };

export interface ParentalViewProps {
  model: ParentalViewModel;
  onBack?: () => void;
  onRetry?: () => void;
  onAge?: (key: string) => void;
  onLibrary?: (id: string) => void;
}
