/**
 * Comparaison de versions « x.y.z » (préfixe `v` toléré, suffixe de
 * pré-version ignoré) : `true` si `candidate` est plus récente que `current`.
 *
 * Une mise à jour de plugin se décidait sur `!==` : un registre revenu en
 * arrière, ou une version installée à la main plus récente que celle publiée,
 * proposait alors comme « mise à jour » un retour à une version antérieure.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => v.trim().replace(/^v/i, "").split(/[-+]/)[0].split(".").map((n) => parseInt(n, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
