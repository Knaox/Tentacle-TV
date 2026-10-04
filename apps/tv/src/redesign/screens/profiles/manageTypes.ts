import type { FamilyProfileColor } from "@tentacle-tv/shared";
import type { PinPadModel } from "./profilesTypes";

/**
 * Le contrat de « Gérer les profils » (Apple TV, profil du propriétaire) :
 * l'intégration résout tout ce qui dépend de la famille ; la vue traduit ses
 * libellés fixes et rend les gestes.
 */

export type ManageAction = "remove" | "delete" | "cancel";

export interface ManageRowView {
  id: string;
  name: string;
  color: FamilyProfileColor | null;
  avatarUri?: string;
  /** « Propriétaire », « Membre », « Invité », « Invitation envoyée · expire le … ». */
  detail: string;
  invitation: boolean;
  /** Le geste de la ligne, à double appui ; null pour le propriétaire. */
  action: { kind: ManageAction; hint: string } | null;
}

export interface ManageNotice {
  text: string;
  tone: "success" | "error";
}

export interface InviteCandidateView {
  id: string;
  name: string;
  avatarUri?: string;
  /** L'invitation vient de partir. */
  sent: boolean;
}

export type ManageViewModel =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  /** La gestion se rouvre par le PIN du propriétaire (dix minutes). */
  | { kind: "pin"; pad: PinPadModel }
  | {
      kind: "list";
      subtitle: string;
      rows: ManageRowView[];
      canCreateGuest: boolean;
      canInvite: boolean;
      /** Pourquoi un geste manque (« Trois invités au plus par famille. »). */
      blocked: string | null;
      /** La ligne dont le geste est armé (premier appui). */
      armedId: string | null;
      notice: ManageNotice | null;
    }
  | { kind: "guest"; name: string; color: FamilyProfileColor; creating: boolean; error: string | null }
  | {
      kind: "invite";
      query: string;
      /** null : la recherche court. */
      candidates: InviteCandidateView[] | null;
      /** D'autres comptes répondent : la page n'en montre que les premiers. */
      more: boolean;
      notice: ManageNotice | null;
    };

export interface ManageProfilesViewProps {
  model: ManageViewModel;
  onBack?: () => void;
  onRetry?: () => void;
  onCreateGuest?: () => void;
  onInvite?: () => void;
  onRowAction?: (id: string) => void;
  onRowBlur?: (id: string) => void;
  onGuestName?: (name: string) => void;
  onGuestColor?: (color: FamilyProfileColor) => void;
  onGuestSubmit?: () => void;
  onQuery?: (query: string) => void;
  onSearch?: () => void;
  onInviteCandidate?: (id: string) => void;
  onDigit?: (digit: string) => void;
  onErase?: () => void;
}
