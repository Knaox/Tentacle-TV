/**
 * La clé de focus d'une carte — celle que le banc fige et que l'intégration
 * lie par le port du focus (`focus/focusBinding.tsx`) : `<rangée>:<index>`,
 * posée par sa rangée ou sa grille.
 */

/**
 * L'index de la carte `<prefix>:<index>` que désigne `key`, ou null. Une
 * rangée s'en sert pour savoir laquelle de ses cartes a l'air focalisée.
 * `reco` ne désigne pas `reco:forYou:1` : l'index doit suivre le préfixe.
 */
export function cardIndexOf(key: string | null, prefix: string): number | null {
  if (!key?.startsWith(`${prefix}:`)) return null;
  const rest = key.slice(prefix.length + 1);
  return /^\d+$/.test(rest) ? Number.parseInt(rest, 10) : null;
}
