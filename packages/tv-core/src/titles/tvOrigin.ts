import type { FamilyGuestRights, FamilyProfileKind, TitleOrigin, TitlePlatform, TitleProvider, TitleRequestOrigin, TitlesAccess } from "@tentacle-tv/shared";
import { titlesFeaturesOpen } from "./titlesGate";

/**
 * « Mes demandes » d'un téléviseur — la règle de TOUS les téléviseurs, écrite
 * une fois : une demande faite depuis une TV porte l'origine « tv » et sa
 * plateforme (`tvRequestOrigin`, que l'extension garde avec elle), et la
 * liste des demandes d'une TV ne montre que celles-là (`TV_TITLE_ORIGIN`,
 * `mine?origin=tv`), quelle que soit la TV qui a demandé. Ce que le compte a
 * demandé ailleurs — web, bureau, téléphone, page de l'extension — n'y paraît
 * pas. L'état d'un titre sur ses cartes, lui, reste celui de TOUTES les
 * demandes du compte : il dit où en est le titre, d'où qu'il ait été demandé.
 *
 * Les demandes faites avant cette règle n'ont pas d'origine : elles ne
 * paraissent pas dans la liste d'une TV. Une extension d'avant ignore
 * l'origine, et sa liste reste entière.
 */

/** L'origine de toute demande faite depuis un téléviseur — et le filtre de sa liste. */
export const TV_TITLE_ORIGIN: TitleOrigin = "tv";

export function tvRequestOrigin(platform: TitlePlatform): TitleRequestOrigin {
  return { origin: TV_TITLE_ORIGIN, platform };
}

/** Ce qu'une TV sait de l'extension de demandes, sa garde ouverte. */
export interface TvTitlesGate {
  provider: TitleProvider;
  /** La langue de l'interface, celle des titres que l'extension renvoie. */
  lang: "fr" | "en";
  /** L'origine de toute demande partie de cette TV (`tvRequestOrigin`). */
  origin: TitleRequestOrigin;
}

/**
 * Le profil de la Famille ouvert sur la TV (Apple TV), pour la garde : un
 * INVITÉ ne voit AUCUNE trace de l'extension — comme si le serveur n'en avait
 * pas —, sauf si son propriétaire lui a permis de demander
 * (`guestRights.requestTitles`, contrat Famille v2 ; ses demandes partent
 * alors au nom du propriétaire, c'est le serveur qui s'en charge — et qui
 * refuse, 403, à un invité sans le droit). Un droit absent vaut non. Un
 * membre, le propriétaire, une TV d'avant les profils (`null`) gardent la leur.
 */
export function profileMayRequest(profile: { kind: FamilyProfileKind; guestRights?: FamilyGuestRights | null } | null): boolean {
  return profile?.kind !== "guest" || profile.guestRights?.requestTitles === true;
}

/**
 * La garde des téléviseurs (`titlesFeaturesOpen`, et le profil ouvert —
 * `profileMayRequest`), et ce qu'il faut à leurs fonctions — l'origine
 * comprise : une TV qui passe par elle marque ses demandes d'office.
 * Fermée : `null`.
 */
export function tvTitlesGate(
  provider: TitleProvider | null,
  access: TitlesAccess | null | undefined,
  lang: "fr" | "en",
  platform: TitlePlatform,
  mayRequest = true,
): TvTitlesGate | null {
  if (!mayRequest) return null;
  return provider && titlesFeaturesOpen(provider, access) ? { provider, lang, origin: tvRequestOrigin(platform) } : null;
}
