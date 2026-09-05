/**
 * « Le plugin est présent ET activé » — le prédicat qui gouverne tout bouton
 * dépendant d'un plugin (réglages, badges, entrées de navigation). Il se lit
 * sur la liste que sert `/api/plugins/active` : le serveur n'y met que les
 * plugins installés et activés, et `configEnabled` dit si l'intégration
 * elle-même est allumée par l'admin. Le web reçoit la liste brute (à filtrer
 * ici), le mobile la pré-filtre déjà sur `configEnabled` — le prédicat est le
 * même pour les deux.
 */
export interface PluginPresence {
  pluginId: string;
  configEnabled?: boolean;
}

/** Identifiant du plugin Vigie (demandes de médias, catalogue hors bibliothèque). */
export const SEER_PLUGIN_ID = "seer";

export function isPluginActive(
  plugins: readonly PluginPresence[] | null | undefined,
  pluginId: string,
): boolean {
  return !!plugins?.some((p) => p.pluginId === pluginId && p.configEnabled === true);
}

/** Vigie présente et activée : les réglages « hors bibliothèque » ont un sens. */
export function isVigieActive(plugins: readonly PluginPresence[] | null | undefined): boolean {
  return isPluginActive(plugins, SEER_PLUGIN_ID);
}
