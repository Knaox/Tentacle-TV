/**
 * Les clés de focus d'une carte et de son plateau — celles que le banc fige
 * et que l'intégration lie par le port du focus (`focus/focusBinding.tsx`) :
 *
 *   • la carte : `<rangée>:<index>`, posée par sa rangée ou sa grille ;
 *   • le plateau, un GROUPE (`FocusGroup`) : `<carte>:tray` ;
 *   • un bouton du plateau : `<carte>:tray:<action>` — `play`, `request`,
 *     `watchlist`, `favorite`, `watched`, `details`, `dismiss`.
 */

const TRAY = ":tray";

/** La clé du groupe du plateau d'une carte. */
export function trayGroupKey(cardKey: string): string {
  return `${cardKey}${TRAY}`;
}

/** La clé d'un élément du plateau (`watchlist`) ; rien sans clé de carte. */
export function trayFocusKey(cardKey: string | undefined, id: string): string | undefined {
  return cardKey ? `${cardKey}${TRAY}:${id}` : undefined;
}

/** L'élément du plateau de `cardKey` que désigne `key` (`watchlist`), ou null. */
export function trayIdOf(key: string | null, cardKey: string | undefined): string | null {
  if (!key || !cardKey) return null;
  const prefix = `${cardKey}${TRAY}:`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

/**
 * L'index de la carte `<prefix>:<index>` que désigne `key` — la carte, ou un
 * élément de son plateau (`<prefix>:<index>:tray:…`) ; null sinon. Une rangée
 * s'en sert pour savoir laquelle de ses cartes a l'air focalisée. `reco` ne
 * désigne pas `reco:forYou:1` : l'index doit suivre le préfixe.
 */
export function cardIndexOf(key: string | null, prefix: string): number | null {
  if (!key?.startsWith(`${prefix}:`)) return null;
  const rest = key.slice(prefix.length + 1);
  return /^\d+(:|$)/.test(rest) ? Number.parseInt(rest, 10) : null;
}
