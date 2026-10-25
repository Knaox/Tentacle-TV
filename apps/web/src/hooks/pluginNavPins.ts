/**
 * Une page d'extension est-elle dans la barre ? Module pur (aucun stockage).
 *
 * Le DÉFAUT vient de l'extension (`primary` de ses `navItems`, capacité
 * `plugins.navigation`) ; absent — serveur ou extension d'avant —, il vaut
 * « dans la barre », comme toujours. Le GESTE de l'utilisateur sur cet appareil
 * l'emporte, et lui seul est gardé : `pluginsUnpinned` (retirée alors que le
 * défaut l'y mettait — la liste d'avant, reprise telle quelle) et
 * `pluginsPinned` (ajoutée alors que le défaut la laissait dans « Plus »).
 * Un geste qui revient au défaut s'efface : si l'administrateur change d'avis
 * plus tard, l'appareil qui n'avait rien choisi le suit.
 */

export interface PluginNavPins {
  pluginsUnpinned: string[];
  pluginsPinned: string[];
}

/** Le défaut de l'extension : sans avis, la page est dans la barre. */
const defaultPinned = (primary: boolean | undefined): boolean => primary ?? true;

export function isPluginNavPinnedBy(pins: PluginNavPins, key: string, primary?: boolean): boolean {
  if (pins.pluginsPinned.includes(key)) return true;
  if (pins.pluginsUnpinned.includes(key)) return false;
  return defaultPinned(primary);
}

/** Les listes après le geste « dans la barre : `on` » sur `key`. */
export function withPluginNavPinned(pins: PluginNavPins, key: string, on: boolean, primary?: boolean): PluginNavPins {
  const pluginsPinned = pins.pluginsPinned.filter((k) => k !== key);
  const pluginsUnpinned = pins.pluginsUnpinned.filter((k) => k !== key);
  if (on !== defaultPinned(primary)) (on ? pluginsPinned : pluginsUnpinned).push(key);
  return { pluginsPinned, pluginsUnpinned };
}

/** Une liste de clés lue du stockage : tout ce qui n'est pas une chaîne s'ignore. */
export function readKeyList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
}
