/**
 * Le focus des RÉGLAGES d'un téléviseur — les onglets en colonne, le grand
 * panneau à droite, la liste de choix d'un réglage, et le déplacement d'une
 * entrée dans Réglages › Navigation (la mécanique commune de `nav/arrange`).
 * Module pur : la plateforme pose les guides, verrouille, réclame.
 */

/** L'onglet montré quand la route n'en demande aucun. */
export const SETTINGS_DEFAULT_TAB = "account" as const;

/** La colonne des onglets, le panneau (un groupe qui mémorise). */
export const SETTINGS_TABS_GROUP = "settings:tabs";
export const SETTINGS_PANEL_GROUP = "settings:panel";

export const settingsTabKey = (tab: string): string => `settings:tab:${tab}`;

/**
 * L'entrée des réglages (RG-1), et la destination de la colonne des onglets
 * (RG-2) : l'onglet AFFICHÉ — GAUCHE depuis le panneau revient dessus, jamais
 * sur celui qu'on survolait (le focus d'un onglet ne le montre pas, seul OK).
 */
export function settingsEntryKey(shownTab: string): string {
  return settingsTabKey(shownTab);
}

/** La liste de choix d'un réglage : ses lignes. */
export const settingsChoiceKey = (index: number): string => `settings:choice:${index}`;

/** Elle s'ouvre sur la valeur retenue, sinon la première (RG-11). */
export function settingsChoiceEntryIndex(values: readonly string[], selected: string | null | undefined): number {
  return Math.max(0, values.findIndex((value) => value === selected));
}

/** Réglages › Navigation : les lignes `settings:nav:<case>`, dans l'ordre affiché. */
export const NAV_SETTINGS_ROW_PREFIX = "settings:nav:";
export const navSettingsRowKey = (slot: number): string => `${NAV_SETTINGS_ROW_PREFIX}${slot}`;

/**
 * Ce qui devient infocalisable le temps d'un déplacement (RG-8) : la pastille
 * de chaque ligne, « Tout afficher », « Ordre par défaut » — HAUT / BAS ne
 * quittent pas les lignes, l'entrée soulevée suit le focus.
 */
export function navSettingsLockedKeys(rowCount: number): string[] {
  const keys: string[] = [];
  for (let slot = 0; slot < rowCount; slot++) keys.push(`${navSettingsRowKey(slot)}:visibility`);
  keys.push(`${NAV_SETTINGS_ROW_PREFIX}showAll`, `${NAV_SETTINGS_ROW_PREFIX}resetOrder`);
  return keys;
}

/**
 * « Tout afficher » et « Ordre par défaut » disparaissent sous le doigt : la
 * première ligne prend le focus (RG-10).
 */
export const NAV_SETTINGS_AFTER_RESET = navSettingsRowKey(0);
