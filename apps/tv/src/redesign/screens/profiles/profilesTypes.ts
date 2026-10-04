import type { FamilyProfileColor } from "@tentacle-tv/shared";
import type { PinPhase } from "@tentacle-tv/tv-core";

/**
 * Le contrat de « Qui regarde ? » et du pavé du code PIN : ce que
 * l'intégration résout avant de monter la vue. Les libellés FIXES sont
 * traduits par la vue ; ce qui dépend des profils arrive résolu.
 */

export interface ProfileTileModel {
  id: string;
  name: string;
  color: FamilyProfileColor;
  /** Le portrait Jellyfin (`imageTag`) ; absent → l'initiale. */
  avatarUri?: string;
  hasPin: boolean;
  guest: boolean;
  /** « Bloqué jusqu'à 22:15 » ; null s'il ne l'est pas. */
  lockedLabel: string | null;
}

export interface PinPadModel {
  profile: ProfileTileModel;
  /** « Code PIN de Léa ». */
  title: string;
  /** Une ligne de plus sous le titre (le PIN protège aussi la gestion). */
  hint: string | null;
  /** Chiffres déjà tapés (les points pleins). */
  typed: number;
  phase: PinPhase;
  /** Ce qui s'est passé : code faux (essais restants), blocage, refus. */
  message: string | null;
}

export type ProfilesViewModel =
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string; secondary: { label: string; armed: boolean } | null }
  | {
      kind: "picker";
      profiles: ProfileTileModel[];
      remember: boolean;
      canManage: boolean;
      notice: string | null;
      /** L'entrée dans un profil choisi (sa session s'ouvre) : son index, et « Ouverture de Léa… ». */
      entering: { index: number; label: string } | null;
    }
  | { kind: "pin"; pad: PinPadModel };

export interface ProfilesViewProps {
  model: ProfilesViewModel;
  onRetry?: () => void;
  /** Le second geste d'une erreur (déjumeler, à double appui). */
  onErrorSecondary?: () => void;
  onPick?: (index: number) => void;
  onFocusProfile?: (index: number) => void;
  onToggleRemember?: () => void;
  onManage?: () => void;
  onDigit?: (digit: string) => void;
  onErase?: () => void;
  /** La croix du pavé : retour aux profils. */
  onBack?: () => void;
}
