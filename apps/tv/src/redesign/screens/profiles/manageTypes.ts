import type { FamilyCandidateStatus, FamilyProfileColor } from "@tentacle-tv/shared";
import type { IconName } from "../../icons/Icon";
import type { PinPadModel } from "./profilesTypes";

/**
 * Le contrat de « Gérer les profils » (Apple TV, profil de qui gère — le
 * propriétaire, ou un membre avec SES droits) :
 * l'intégration résout tout ce qui dépend de la famille ; la vue traduit ses
 * libellés fixes et rend les gestes.
 */

export type ManageAction = "remove" | "delete" | "cancel";

export interface ManageRowView {
  id: string;
  name: string;
  color: FamilyProfileColor | null;
  avatarUri?: string;
  /** « Propriétaire », « Parent », « Membre », « Invité · ajouté par … », « Invitation envoyée · expire le … ». */
  detail: string;
  invitation: boolean;
  /** Une invitation : « Annuler », à double appui ; null sinon. */
  action: { kind: ManageAction; hint: string } | null;
  /** Le profil a une FICHE (des gestes pour la session) : OK l'ouvre. */
  opens: boolean;
}

/** Une ligne de la fiche d'un profil : un réglage oui/non, ou un geste. */
export interface SheetRowView {
  /** Sa clé de focus (tv-core `manageSheetKey`). */
  key: string;
  kind: "toggle" | "action";
  icon: IconName;
  title: string;
  description?: string;
  /** Un geste : son état à droite (« Activé »), un chevron s'il ouvre une page. */
  state?: string;
  opens?: boolean;
  tone?: "default" | "danger";
  /** Premier appui d'un geste à double appui. */
  armed?: boolean;
  /** Un réglage : sa valeur. */
  value?: boolean;
}

/** La FICHE d'un profil : qui, et ce que la session peut y faire. */
export interface ManageSheetView {
  id: string;
  name: string;
  color: FamilyProfileColor | null;
  avatarUri?: string;
  /** Son rôle (« Invité · ajouté par … »). */
  detail: string;
  rows: SheetRowView[];
  notice: ManageNotice | null;
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
  /** v2 : seul `available` s'invite ; les autres disent pourquoi. */
  status: FamilyCandidateStatus;
}

export type ManageViewModel =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  /** La gestion se rouvre par le PIN du profil qui gère (dix minutes). */
  | { kind: "pin"; pad: PinPadModel }
  /** Ce profil gérerait avec un code PIN : la page invite à en poser un. */
  | { kind: "needsPin" }
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
  /** La fiche d'un profil. */
  | { kind: "profile"; sheet: ManageSheetView }
  /** Le code PIN d'un invité : le nouveau, puis sa confirmation. */
  | { kind: "guestPin"; pad: PinPadModel }
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
  /** OK sur une ligne : ouvre sa fiche, ou arme / exécute « Annuler l'invitation ». */
  onRowAction?: (id: string) => void;
  onRowBlur?: (id: string) => void;
  /** OK sur une ligne de la fiche (sa clé). */
  onSheetRow?: (key: string) => void;
  onSheetRowBlur?: (key: string) => void;
  onGuestName?: (name: string) => void;
  onGuestColor?: (color: FamilyProfileColor) => void;
  onGuestSubmit?: () => void;
  onQuery?: (query: string) => void;
  onSearch?: () => void;
  onInviteCandidate?: (id: string) => void;
  onDigit?: (digit: string) => void;
  onErase?: () => void;
  /** « Créer un code PIN » (sans code, pas de gestion depuis la TV). */
  onCreatePin?: () => void;
}
