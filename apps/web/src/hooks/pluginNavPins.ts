/**
 * Une page d'extension est-elle dans la barre ? Module pur (aucun stockage).
 *
 * L'extension dit si la page a sa place dans la barre principale (`primary` de
 * ses `navItems`, capacité `plugins.navigation`, réglé par son administration :
 * « Afficher dans la barre de navigation principale ») :
 *
 * - `primary: false` — la page n'est PAS une destination de la barre : elle ne
 *   s'y montre pas et ne s'y épingle pas, nulle part (barre, « Personnaliser la
 *   barre », « Plus », barre du téléphone) ; elle reste ouverte depuis « Plus ».
 *   Une épingle d'avant de l'appareil n'est pas effacée : si l'administration
 *   la réaffiche, elle revient d'elle-même (Damien, 26/10).
 * - sinon (`true`, ou absent — serveur ou extension d'avant) : dans la barre,
 *   comme toujours, sauf si l'appareil l'en a retirée (`pluginsUnpinned`, la
 *   liste d'avant, reprise telle quelle).
 *
 * `pluginsPinned` (une page de « Plus » épinglée quand `primary: false` n'était
 * qu'un défaut, avant le 26/10) est lue sans effet et gardée telle quelle.
 */

export interface PluginNavPins {
  pluginsUnpinned: string[];
  pluginsPinned: string[];
}

/** La page peut-elle être dans la barre ? Non seulement si l'extension la cache (`primary: false`). */
export function pluginNavPinnable(primary?: boolean): boolean {
  return primary !== false;
}

export function isPluginNavPinnedBy(pins: PluginNavPins, key: string, primary?: boolean): boolean {
  if (!pluginNavPinnable(primary)) return false;
  return !pins.pluginsUnpinned.includes(key);
}

/** Les listes après le geste « dans la barre : `on` » sur `key` ; une page cachée par l'extension ne bouge pas. */
export function withPluginNavPinned(pins: PluginNavPins, key: string, on: boolean, primary?: boolean): PluginNavPins {
  if (!pluginNavPinnable(primary)) return pins;
  const pluginsUnpinned = pins.pluginsUnpinned.filter((k) => k !== key);
  if (!on) pluginsUnpinned.push(key);
  return { pluginsPinned: pins.pluginsPinned.filter((k) => k !== key), pluginsUnpinned };
}

/** Une liste de clés lue du stockage : tout ce qui n'est pas une chaîne s'ignore. */
export function readKeyList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
}
