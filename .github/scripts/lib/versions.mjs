// Numéros de version « X.Y.Z » : validation et comparaison. Zéro dépendance.
//
// Tout ce qui sort d'une boutique, d'une API ou d'une page publique passe par
// `isVersion` avant d'aller plus loin : une valeur qui n'a pas cette forme
// exacte n'atteint jamais un manifeste, une URL ni un message.
export const VERSION_RE = /^\d+\.\d+\.\d+$/;

export const isVersion = (v) => typeof v === 'string' && VERSION_RE.test(v);

/** Négatif si a < b, positif si a > b, zéro si égales. */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** La plus haute version valide de la liste, ou null. */
export function maxVersion(list) {
  let best = null;
  for (const v of list) {
    if (isVersion(v) && (best === null || compareVersions(v, best) > 0)) best = v;
  }
  return best;
}

/** La plus basse version valide de la liste, ou null. */
export function minVersion(list) {
  let best = null;
  for (const v of list) {
    if (isVersion(v) && (best === null || compareVersions(v, best) < 0)) best = v;
  }
  return best;
}

/**
 * Les versions d'un changelog, de la plus haute à la plus basse, sans doublon.
 * Les blocs par canal (« ## [win-1.2.3] ») comptent pour leur version.
 */
export function changelogVersions(md) {
  const found = new Set();
  for (const m of md.matchAll(/^##\s*\[(?:[a-z]+-)?(\d+\.\d+\.\d+)\]/gm)) found.add(m[1]);
  return [...found].sort((a, b) => compareVersions(b, a));
}
