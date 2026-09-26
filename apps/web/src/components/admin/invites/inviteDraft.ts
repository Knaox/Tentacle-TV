import {
  INVITE_EXPIRY_HOURS_LIMIT,
  INVITE_MAX_USES_LIMIT,
  type CreateInviteRequest,
} from "@tentacle-tv/shared";

/**
 * Le formulaire « Nouvelle invitation » en logique pure : des préréglages
 * pour les cas courants, une saisie libre pour le reste, et une validation
 * AVANT l'envoi. L'ancien écran envoyait `+e.target.value` tel quel : un champ
 * vidé partait en NaN (sérialisé `null`) et le serveur répondait un 400 que
 * personne ne voyait.
 */

export const USES_PRESETS = [1, 5, 10] as const;
export const EXPIRY_PRESET_DAYS = [1, 3, 7, 30] as const;

export type ExpiryUnit = "hours" | "days";

export interface InviteDraft {
  /** Un préréglage, ou `"custom"` : la saisie libre fait alors foi. */
  uses: number | "custom";
  customUses: string;
  /** La durée d'un préréglage, en heures, ou `"custom"`. */
  expiryHours: number | "custom";
  customExpiry: string;
  customUnit: ExpiryUnit;
}

/** Une personne, trois jours : les réglages de l'ancien écran. */
export const DEFAULT_DRAFT: InviteDraft = {
  uses: 1,
  customUses: "",
  expiryHours: 3 * 24,
  customExpiry: "",
  customUnit: "days",
};

export type UsesError = "range";
export type ExpiryError = "invalid" | "tooLong";

export type DraftResult =
  | { ok: true; request: Required<CreateInviteRequest> }
  | { ok: false; usesError: UsesError | null; expiryError: ExpiryError | null };

/** Un entier écrit en chiffres, rien d'autre : « 1e3 », « 2,5 » ou un champ vide ne passent pas. */
function parseCount(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : null;
}

export function resolveDraft(draft: InviteDraft): DraftResult {
  const uses = draft.uses === "custom" ? parseCount(draft.customUses) : draft.uses;
  const usesError: UsesError | null =
    uses !== null && uses >= 1 && uses <= INVITE_MAX_USES_LIMIT ? null : "range";

  let hours: number | null = null;
  if (draft.expiryHours !== "custom") hours = draft.expiryHours;
  else {
    const value = parseCount(draft.customExpiry);
    if (value !== null) hours = draft.customUnit === "days" ? value * 24 : value;
  }
  const expiryError: ExpiryError | null =
    hours === null || hours < 1 ? "invalid" : hours > INVITE_EXPIRY_HOURS_LIMIT ? "tooLong" : null;

  if (uses === null || hours === null || usesError || expiryError) {
    return { ok: false, usesError, expiryError };
  }
  return { ok: true, request: { maxUses: uses, expiresInHours: hours } };
}
