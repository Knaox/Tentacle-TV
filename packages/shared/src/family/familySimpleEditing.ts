import type { ServerCapability } from "../serverCapabilities/serverCapabilities";
import type { FamilyOverviewDto, FamilyProfileDto } from "./familyContract";
import { profileActions, sessionManages, type ProfileActionsCapability } from "./familyClient";
import { profileRoleActions } from "./familyRolesClient";
import type { RightsSummaryKind } from "./familyRightsSummary";

/**
 * Ce qu'un écran SIMPLE (mobile, tablette, web étroit) peut régler sur UN
 * profil de la famille — décision de Damien (20/10) : les droits de la Famille
 * qui tiennent dans un interrupteur, une liste ou un choix se règlent partout ;
 * le reste (étiquettes, types non classés, horaires, sous-notes) reste au
 * bureau ou sur le web (« Plus de réglages sur le bureau ou le web »). Les
 * droits d'ADMINISTRATION (Watch Together, hors ligne, lecture…) ne sont pas
 * des droits de la Famille : jamais ici.
 *
 * Règle PURE, bâtie sur celles du web et du bureau (`profileActions`,
 * `profileRoleActions`) — mêmes appelants, mêmes routes (`FAMILY_ROUTES`) :
 * le propriétaire ; un parent pour les mineurs et les invités ; un membre pour
 * SES invités si le propriétaire le permet. Le serveur revérifie tout.
 */
export interface FamilySimpleEditing {
  /** « Peut demander des films » (un invité). */
  requestTitles: boolean;
  /** « Peut créer des invités » (un membre). */
  createGuests: boolean;
  /** Nommer ou retirer un parent (un membre) ; `parentBlocked` : refusé tant qu'un contrôle le restreint. */
  parent: boolean;
  parentBlocked: boolean;
  /** L'âge maximal par paliers (`familyParentalAge`) : un invité réglable, un membre mineur. */
  age: boolean;
  /** Les bibliothèques autorisées (`familyParentalLibraries`). */
  libraries: boolean;
  /** Quelque chose se règle ici ; sinon, le résumé en lecture seule. */
  any: boolean;
  /** Le reste du contrôle parental (étiquettes, non classés, horaires) se règle au bureau ou sur le web. */
  moreElsewhere: boolean;
}

const NOTHING: FamilySimpleEditing = {
  requestTitles: false, createGuests: false, parent: false, parentBlocked: false, age: false, libraries: false, any: false, moreElsewhere: false,
};

export function familySimpleEditing(
  overview: FamilyOverviewDto,
  profile: FamilyProfileDto,
  viewerUserId: string | null | undefined,
  capabilities: ReadonlySet<ServerCapability>,
  capability: ProfileActionsCapability = {},
): FamilySimpleEditing {
  // Une session de profil qui n'a pas ouvert la gestion (son code PIN) ne règle rien.
  if (profile.kind === "owner" || !sessionManages(overview.account)) return NOTHING;
  const actions = profileActions(overview, profile, viewerUserId, capability);
  const roles = profileRoleActions(overview, profile, viewerUserId);
  // Le serveur ne rend le contrôle parental (`parental`) qu'à qui peut le régler.
  const regulable = profile.parental !== undefined;
  const ageCapability = profile.kind === "guest" ? "family.parentalControls" : "family.memberParental";
  const age = regulable && capabilities.has(ageCapability) && (profile.kind === "guest" || roles.memberParental);
  const libraries = regulable && capabilities.has("family.libraryLimits") && (profile.kind === "guest" || roles.memberParental);
  const out: FamilySimpleEditing = {
    requestTitles: actions.right === "requestTitles",
    createGuests: actions.right === "createGuests",
    parent: roles.role,
    parentBlocked: roles.roleBlockedByParental,
    age,
    libraries,
    any: false,
    moreElsewhere: age,
  };
  out.any = out.requestTitles || out.createGuests || out.parent || out.age || out.libraries;
  return out;
}

/** Les lignes du résumé que l'écran règle déjà (elles quittent le résumé en lecture seule). */
export function editedSummaryKinds(editing: FamilySimpleEditing): RightsSummaryKind[] {
  const kinds: RightsSummaryKind[] = [];
  if (editing.requestTitles) kinds.push("requestTitles");
  if (editing.createGuests) kinds.push("createGuests");
  if (editing.parent) kinds.push("parent");
  if (editing.age) kinds.push("age");
  if (editing.libraries) kinds.push("libraries");
  return kinds;
}
