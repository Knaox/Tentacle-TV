/**
 * Octave — la FUSION d'un ordre changé sans réseau avec celui que le serveur a
 * entre-temps (lot « ol », 01/11). Pur (`orderMerge.test.ts`).
 *
 * Un ordre glissé hors ligne part au retour du réseau (`orderOutbox.ts`). Entre
 * deux, un autre appareil du compte a pu réordonner la même liste, y ajouter ou
 * en retirer des titres. Jamais d'écrasement en silence ; la règle (à trois
 * voies) :
 *
 * - `base` : l'ordre que l'appareil MONTRAIT avant son premier geste hors ligne ;
 * - `local` : l'ordre voulu après ses gestes ;
 * - `remote` : l'ordre du serveur au moment de l'envoi.
 *
 * 1. Ce que l'appareil a DÉPLACÉ se lit contre `base` : les clés hors de la plus
 *    longue sous-suite commune à `base` et `local` (celles qui gardent leur ordre
 *    relatif ne sont pas « déplacées »).
 * 2. Le résultat part de `remote` : un réordonnancement fait ailleurs sur les
 *    titres que l'appareil n'a PAS touchés est gardé, les titres apparus restent
 *    à leur place, les titres disparus ne reviennent pas (`membership: "remote"`).
 * 3. Chaque clé déplacée se repose juste après celle qui la précède dans `local`
 *    (en tête si rien ne la précède) : l'ordre relatif choisi hors ligne gagne.
 *
 * Sans geste concurrent (`remote` = `base`), le résultat est exactement `local`.
 * Une liste qui n'est pas la vérité de son contenu (un ordre personnalisé, celui
 * d'une rubrique de la bibliothèque : des clés, pas les titres) se fusionne avec
 * `membership: "union"` — une clé que `remote` ne cite pas n'est pas « retirée ».
 */

export type OrderMembership = "remote" | "union";

/** Les rangs d'une plus longue sous-suite croissante de `values` (patience, O(n log n)). */
function longestIncreasing(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const tailAt: number[] = [];
  const previous: number[] = new Array<number>(values.length).fill(-1);
  values.forEach((value, index) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid]! < value) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) previous[index] = tailAt[lo - 1]!;
    tails[lo] = value;
    tailAt[lo] = index;
  });
  const out = new Set<number>();
  for (let at = tails.length > 0 ? tailAt[tails.length - 1]! : -1; at >= 0; at = previous[at]!) out.add(at);
  return out;
}

/** Les clés de `local` que l'appareil a déplacées par rapport à `base` (absentes de `base` comprises). */
export function movedKeys(base: readonly string[], local: readonly string[]): Set<string> {
  const baseIndex = new Map<string, number>();
  base.forEach((key, index) => {
    if (!baseIndex.has(key)) baseIndex.set(key, index);
  });
  const known = local.filter((key) => baseIndex.has(key));
  const spine = longestIncreasing(known.map((key) => baseIndex.get(key)!));
  const kept = new Set(known.filter((_, index) => spine.has(index)));
  return new Set(local.filter((key) => !kept.has(key)));
}

/** L'ordre fusionné (voir l'en-tête). Les clés sont uniques (un doublon se distingue par `withOccurrences`). */
export function mergeOrder(base: readonly string[], local: readonly string[], remote: readonly string[], membership: OrderMembership = "remote"): string[] {
  const moved = movedKeys(base, local);
  const present = new Set(remote);
  // Union : une clé que le serveur ne cite pas, et que l'appareil n'a pas déplacée, garde sa place relative.
  const uncited = new Set<string>();
  if (membership === "union") {
    for (const key of local) {
      if (present.has(key)) continue;
      present.add(key);
      if (!moved.has(key)) uncited.add(key);
    }
  }
  // Le rang (approché) de chaque clé placée dans le résultat : celui du serveur, ou celui de son ancre.
  const rank = new Map<string, number>(remote.map((key, index) => [key, index]));
  const after = new Map<string | null, string[]>();
  const anchorAt = (anchor: string | null, key: string): void => {
    const list = after.get(anchor);
    if (list) list.push(key);
    else after.set(anchor, [key]);
    rank.set(key, anchor === null ? -1 : (rank.get(anchor) ?? -1));
  };
  // Une clé DÉPLACÉE se pose juste après la dernière clé placée qui la précède dans `local` ; une clé non citée,
  // après la plus avancée dans le résultat de celles qui la précèdent (elle ne remonte pas devant elles).
  let lastPlaced: string | null = null;
  let furthest: string | null = null;
  for (const key of local) {
    if (!present.has(key)) continue;
    if (moved.has(key) || uncited.has(key)) moved.add(key);
    if (uncited.has(key)) anchorAt(furthest, key);
    else if (moved.has(key)) anchorAt(lastPlaced, key);
    lastPlaced = key;
    if (furthest === null || (rank.get(key) ?? -1) >= (rank.get(furthest) ?? -1)) furthest = key;
  }
  const out: string[] = [];
  // Itératif : une chaîne de milliers de clés déplacées ne fait pas déborder la pile.
  const emitAfter = (anchor: string | null): void => {
    const stack: string[] = [...(after.get(anchor) ?? [])].reverse();
    while (stack.length > 0) {
      const key = stack.pop()!;
      out.push(key);
      const next = after.get(key);
      if (next) for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]!);
    }
  };
  emitAfter(null);
  for (const key of remote) {
    if (moved.has(key)) continue;
    out.push(key);
    emitAfter(key);
  }
  return out;
}

const OCCURRENCE = "\u0000";

/** Un titre présent deux fois : sa deuxième occurrence devient `clé\u00002` (la fusion veut des clés uniques). */
export function withOccurrences(keys: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return keys.map((key) => {
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key}${OCCURRENCE}${n}`;
  });
}

/** La clé d'origine d'une clé distinguée par `withOccurrences`. */
export function withoutOccurrence(key: string): string {
  const at = key.indexOf(OCCURRENCE);
  return at < 0 ? key : key.slice(0, at);
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}
