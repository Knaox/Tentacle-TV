/**
 * Octave (mobile) — ce que montre le hub « Compte », règle PURE (`accountHubRows.test.ts`). Rien n'y est
 * décidé à nouveau : les gestes du PROFIL viennent du catalogue partagé des réglages (rubrique « Compte »,
 * `settingsSections.ts`, mêmes conditions que Tentacle — session de profil, Famille, profils), le code PIN de
 * la vue d'ensemble de la Famille (`familyScreenModel` → `showMyPin` : session personnelle seulement), le hors
 * ligne du droit de son écran dans le registre d'Octave. Le hub ne fait que les ranger.
 */

import { findSettingsSection, visibleSettingsGroups, type SettingsCatalogContext } from "@tentacle-tv/shared";

export type AccountProfileRow = "switchProfile" | "pin" | "manageProfiles";

export interface AccountHubInput {
  /** Les identifiants visibles de la rubrique « Compte » du catalogue, dans ce contexte. */
  catalogIds: ReadonlySet<string>;
  /** Le code PIN : `null` tant que la Famille n'a pas répondu, ou si elle ne le propose pas. */
  pin: { shown: boolean } | null;
}

/** Les lignes du groupe « Profil », dans l'ordre : changer, son code, gérer la famille. */
export function accountProfileRows({ catalogIds, pin }: AccountHubInput): AccountProfileRow[] {
  const rows: AccountProfileRow[] = [];
  if (catalogIds.has("switchProfile")) rows.push("switchProfile");
  if (pin?.shown) rows.push("pin");
  // « Famille » du catalogue (session personnelle, entrée utile) : la même page, DANS Octave.
  if (catalogIds.has("family")) rows.push("manageProfiles");
  return rows;
}

/** Les identifiants de la rubrique « Compte » que ce contexte montre (catalogue partagé). */
export function accountCatalogIds(ctx: SettingsCatalogContext): Set<string> {
  const section = findSettingsSection("account");
  if (!section) return new Set();
  return new Set(visibleSettingsGroups(section, ctx).flatMap((group) => group.entries.map((entry) => entry.id)));
}
