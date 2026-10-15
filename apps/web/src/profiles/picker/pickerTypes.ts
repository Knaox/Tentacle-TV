import type { FamilyProfileColor } from "@tentacle-tv/shared";

/**
 * Le contrat des vues de « Qui regarde ? » sur le bureau : ce que l'intégration
 * résout avant de les monter. Les libellés FIXES sont traduits par les vues ;
 * ce qui dépend des profils arrive résolu. Calqué sur celui de l'Apple TV
 * (`apps/tv/src/redesign/screens/profiles/profilesTypes.ts`).
 */

export interface PickerProfile {
  /** Le compte Jellyfin du profil. */
  id: string;
  name: string;
  color: FamilyProfileColor;
  /** La photo Jellyfin ; null : l'initiale sur la couleur du profil. */
  imageTag: string | null;
  hasPin: boolean;
  /** Le cadenas FERMÉ : le choisir demandera vraiment son code. Faux sur un
   *  profil sans code, et sur le profil en cours (`current`), qui s'ouvre sans. */
  pinLock: boolean;
  /** Le profil en cours sur cet appareil, quand on vient de « Changer de
   *  profil » : le choisir y reste (« Profil actuel », anneau). */
  current: boolean;
  guest: boolean;
  /** Le profil du compte de cette application : « Vous ». */
  own: boolean;
  /** « Bloqué jusqu'à 22:15 » ; null s'il ne l'est pas. */
  lockedLabel: string | null;
}

/** Les phases du pavé : on tape, le code est parti, refusé, bloqué. */
export type PinPadPhase = "typing" | "checking" | "wrong" | "locked";

export interface PinPadModel {
  profile: PickerProfile;
  /** Chiffres déjà tapés (les points pleins). */
  typed: number;
  phase: PinPadPhase;
  /** Ce qui s'est passé, déjà dit en mots : code faux (essais restants), blocage, refus. */
  message: string | null;
}

export type WhoIsWatchingModel =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "picker";
      profiles: readonly PickerProfile[];
      /** « Gérer les profils » s'offre (session personnelle et droits sur la famille). */
      canManage: boolean;
      /** Un refus à dire au-dessus de la rangée (profil retiré, familles coupées…). */
      notice: string | null;
      /** L'entrée dans un profil choisi : son identifiant, et « Ouverture de Léa… » si le serveur tarde. */
      entering: { id: string; label: string | null } | null;
      /** Le profil qui reprend le focus (retour du pavé) ; absent : le premier. */
      focusId?: string | null;
      /** « Ne plus proposer sur cet appareil » : cochée ou non ; null (ou absent)
       *  quand la case est sans objet (le compte ne demande pas qui regarde). */
      stay?: boolean | null;
    }
  | { kind: "pin"; pad: PinPadModel };
