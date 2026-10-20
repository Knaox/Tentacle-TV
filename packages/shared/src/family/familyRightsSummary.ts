/**
 * Le RÉSUMÉ des droits d'un profil de la famille, en lecture seule — décision
 * de Damien (20/10) : les droits de la Famille s'APPLIQUENT partout mais se
 * RÈGLENT à un seul endroit, le bureau ou le web. Le mobile, la tablette et le
 * web étroit montrent ce résumé puis « Modifier sur le bureau ou le web ».
 *
 * Règle PURE : elle lit ce que le serveur a rendu (`FamilyProfileDto`, et les
 * bibliothèques lues à la demande, `FamilyLibrariesDto`) et rend des lignes
 * (clé i18n de l'espace `familyRightsSummary`, variables, ton). Elle n'invente
 * rien : un champ absent (serveur d'avant, appelant qui ne peut pas régler ce
 * profil) ne donne pas de ligne, jamais une valeur supposée.
 *
 * Ce que l'administration a coupé n'a PAS de ligne (retours de l'alpha, 21/10) :
 * « Peut demander des films » sans `features.family.guestRequests`, « Peut créer
 * des invités » sans les profils invités (`features.family.guests`).
 *
 * Âge : le contrôle VOULU recoupé par le PLAFOND (créateur d'un invité, base de
 * l'administrateur d'un membre) — ce que Jellyfin applique vraiment. Les
 * scores de Jellyfin 10.11 sont des âges (docs/DROITS-UTILISATEURS.md § 9.8.2).
 */

import type { FamilyCapability, FamilyProfileDto } from "./familyContract";
import type { FamilyLibrariesDto } from "./familyLibraries";
import type { GuestParentalControls } from "./familyParental";

export type RightsSummaryKind =
  | "libraries"
  | "age"
  | "unrated"
  | "tags"
  | "schedule"
  | "requestTitles"
  | "createGuests"
  | "parent"
  | "watchTogether"
  | "offline"
  | "account";

/** `allowed` : le profil peut ; `limited` : une restriction ; `denied` : il ne peut pas ; `info` : un rappel. */
export type RightsSummaryTone = "allowed" | "limited" | "denied" | "info";

export interface RightsSummaryLine {
  kind: RightsSummaryKind;
  tone: RightsSummaryTone;
  /** Clé de l'espace i18n `familyRightsSummary`. */
  key: string;
  params?: Record<string, string | number>;
}

export interface FamilyRightsSummary {
  lines: RightsSummaryLine[];
  /** Vrai dès qu'il y a quelque chose à régler : « Modifier sur le bureau ou le web ». */
  editElsewhere: boolean;
}

export interface FamilyRightsSummaryInput {
  profile: FamilyProfileDto;
  /** Les bibliothèques du profil (`GET /api/family/profiles/:userId/libraries`) ; absent : pas de ligne. */
  libraries?: FamilyLibrariesDto | null;
  /** `GET /api/config` › `features.family` : ce que l'administration permet. Absent : toutes les
   *  lignes, comme avant. */
  family?: Pick<FamilyCapability, "guests" | "guestRequests">;
}

/** La note maximale que Jellyfin applique : la plus stricte du voulu et du plafond (null : aucune). */
export function effectiveMaxRating(
  wanted: Pick<GuestParentalControls, "maxParentalRating"> | null | undefined,
  ceiling: Pick<GuestParentalControls, "maxParentalRating"> | null | undefined,
): number | null {
  const scores = [wanted?.maxParentalRating, ceiling?.maxParentalRating].filter((s): s is number => typeof s === "number");
  return scores.length === 0 ? null : Math.min(...scores);
}

function librariesLine(libraries: FamilyLibrariesDto): RightsSummaryLine {
  const available = libraries.available;
  if (libraries.allowed === null) return { kind: "libraries", tone: "allowed", key: "libraries.all" };
  const allowed = new Set(libraries.allowed.map((id) => id.replace(/-/g, "").toLowerCase()));
  const names = available.filter((lib) => allowed.has(lib.id.replace(/-/g, "").toLowerCase())).map((lib) => lib.name);
  if (names.length === 0) return { kind: "libraries", tone: "denied", key: "libraries.none" };
  if (names.length >= available.length) return { kind: "libraries", tone: "allowed", key: "libraries.all" };
  return {
    kind: "libraries",
    tone: "limited",
    key: names.length === 1 ? "libraries.one" : "libraries.some",
    params: { count: names.length, total: available.length, names: names.join(", ") },
  };
}

function parentalLines(profile: FamilyProfileDto): RightsSummaryLine[] {
  if (profile.parental === undefined) return [];
  const wanted = profile.parental;
  const ceiling = profile.parentalCeiling ?? null;
  const max = effectiveMaxRating(wanted, ceiling);
  const lines: RightsSummaryLine[] = [
    max === null
      ? { kind: "age", tone: "allowed", key: "age.none" }
      : max <= 0
        ? { kind: "age", tone: "limited", key: "age.allAudiences" }
        : { kind: "age", tone: "limited", key: "age.upTo", params: { age: max } },
  ];
  const unrated = new Set([...(wanted?.blockUnratedItems ?? []), ...(ceiling?.blockUnratedItems ?? [])]);
  if (unrated.size > 0) lines.push({ kind: "unrated", tone: "limited", key: "unrated" });
  const tags = new Set([...(wanted?.blockedTags ?? []), ...(ceiling?.blockedTags ?? [])]);
  if (tags.size > 0) lines.push({ kind: "tags", tone: "limited", key: "tags", params: { count: tags.size } });
  if ((wanted?.accessSchedules.length ?? 0) > 0 || (ceiling?.accessSchedules.length ?? 0) > 0) {
    lines.push({ kind: "schedule", tone: "limited", key: "schedule" });
  }
  return lines;
}

function guestLines(profile: FamilyProfileDto, family: FamilyRightsSummaryInput["family"]): RightsSummaryLine[] {
  const rights = profile.guestRights ?? null;
  const request: RightsSummaryLine = rights?.suspended
    ? { kind: "requestTitles", tone: "denied", key: "requestTitles.suspended" }
    : rights?.requestTitles
      ? { kind: "requestTitles", tone: "allowed", key: "requestTitles.on" }
      : { kind: "requestTitles", tone: "denied", key: "requestTitles.off" };
  return [
    ...(family && family.guestRequests !== true ? [] : [request]),
    // Fixés par le serveur pour tout invité (`profileSessionLimits.ts`) : dits, jamais réglables.
    { kind: "watchTogether", tone: "denied", key: "watchTogether.guest" },
    { kind: "offline", tone: "denied", key: "offline.guest" },
  ];
}

function memberLines(profile: FamilyProfileDto, family: FamilyRightsSummaryInput["family"]): RightsSummaryLine[] {
  const lines: RightsSummaryLine[] = [];
  if (profile.parent) lines.push({ kind: "parent", tone: "allowed", key: "parent" });
  if (profile.rights && family?.guests !== false) {
    lines.push(profile.rights.createGuests
      ? { kind: "createGuests", tone: "allowed", key: "createGuests.on" }
      : { kind: "createGuests", tone: "denied", key: "createGuests.off" });
  }
  // Watch Together, hors ligne, partage : les droits de SON compte, réglés par l'administrateur.
  lines.push({ kind: "account", tone: "info", key: "account" });
  return lines;
}

/**
 * Le résumé d'un profil. Le propriétaire n'a rien à résumer : ses droits sont
 * ceux de son compte, que seule l'administration règle (aucune ligne).
 */
export function familyRightsSummary({ profile, libraries, family }: FamilyRightsSummaryInput): FamilyRightsSummary {
  if (profile.kind === "owner") return { lines: [], editElsewhere: false };
  const lines: RightsSummaryLine[] = [];
  if (libraries) lines.push(librariesLine(libraries));
  lines.push(...parentalLines(profile));
  lines.push(...(profile.kind === "guest" ? guestLines(profile, family) : memberLines(profile, family)));
  return { lines, editElsewhere: lines.some((line) => line.tone !== "info") };
}
