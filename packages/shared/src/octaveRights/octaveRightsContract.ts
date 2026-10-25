/**
 * « Accès à Octave » — le droit TENTACLE d'un compte au mode musique
 * (capacité `octave.rights`, serveur 1.32.0). Ce n'est pas un champ de la
 * politique Jellyfin : Tentacle le garde (`octave_account_rights`, sans ligne =
 * permis). Allumé par défaut : rien ne change pour personne tant que
 * l'administration ne le coupe pas.
 *
 * Le SERVEUR le tient : sans lui, les routes musique du cœur répondent 403
 * `octave_access_denied` (`/api/music/status` répond « indisponible »), et
 * l'extension de musique ne lui est plus offerte (ni dans `/api/plugins/active`,
 * ni par son relais). Les clients ne font que lire `/api/music/status`.
 *
 * Un invité de la Famille suit la politique de son créateur : son accès est
 * celui de son créateur, il ne se règle pas à part (`family_guest`).
 *
 * MIROIR : `apps/backend/src/octaveRights/octaveRightsContract.ts`, octet pour
 * octet. On modifie ICI, on recopie :
 *
 *   cp packages/shared/src/octaveRights/octaveRightsContract.ts apps/backend/src/octaveRights/
 *
 * ⚠️ Les clés traversent le réseau : elles ne se renomment jamais.
 */

/** Le refus d'une route musique du cœur pour un compte sans « Accès à Octave » (403). */
export const OCTAVE_ACCESS_DENIED = "octave_access_denied";

export interface OctaveRightsRouteSpec {
  method: "GET" | "PUT";
  path: string;
}

/** Réglage par l'administration : `requirePersonalAdmin`, jamais une TV ni une session de profil. */
export const OCTAVE_RIGHTS_ROUTES = {
  /** → `OctaveAccountRightsDto`. */
  read: { method: "GET", path: "/api/admin/users/:userId/octave" },
  /** `SetOctaveAccountRightsBody` → `OctaveAccountRightsDto`. */
  update: { method: "PUT", path: "/api/admin/users/:userId/octave" },
} as const satisfies Record<string, OctaveRightsRouteSpec>;

export type OctaveRightsRouteName = keyof typeof OCTAVE_RIGHTS_ROUTES;

export function octaveRightsPath(name: OctaveRightsRouteName, userId: string): string {
  if (!userId) throw new Error(`octaveRightsPath(${name}) : compte manquant`);
  return OCTAVE_RIGHTS_ROUTES[name].path.replace(":userId", encodeURIComponent(userId));
}

/** Les droits Tentacle d'un compte pour la musique. */
export interface OctaveAccountRightsDto {
  userId: string;
  /** « Accès à Octave » : le mode musique, ses routes et l'extension de musique. */
  access: boolean;
}

/** Le correctif : les SEULS champs présents changent (au moins un). */
export interface SetOctaveAccountRightsBody {
  access?: boolean;
}

/** Les refus de l'administration (`{ error }`), liste FERMÉE. */
export const OCTAVE_RIGHTS_REFUSALS = ["unknown_user", "family_guest", "invalid_value", "unavailable"] as const;
export type OctaveRightsRefusal = (typeof OCTAVE_RIGHTS_REFUSALS)[number];

export const OCTAVE_RIGHTS_REFUSAL_STATUS: Record<OctaveRightsRefusal, number> = {
  unknown_user: 404,
  family_guest: 409,
  invalid_value: 400,
  unavailable: 503,
};

/** Le correctif validé, ou `null` (forme inconnue, champ en trop, aucun champ). */
export function parseOctaveRightsBody(body: unknown): SetOctaveAccountRightsBody | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length === 0) return null;
  const out: SetOctaveAccountRightsBody = {};
  for (const [key, value] of entries) {
    if (key !== "access" || typeof value !== "boolean") return null;
    out.access = value;
  }
  return out;
}

/** Ce qui est gardé pour un compte ; `null` : aucune ligne (le défaut, permis). */
export interface StoredOctaveRights {
  access: boolean;
}

/**
 * La règle (pure) : un invité de la Famille vaut son créateur ; un compte sans
 * ligne est permis. `creator` n'a de sens que pour un invité.
 */
export function resolveOctaveAccess(input: {
  guest: boolean;
  own: StoredOctaveRights | null;
  creator: StoredOctaveRights | null;
}): boolean {
  const stored = input.guest ? input.creator : input.own;
  return stored?.access ?? true;
}
