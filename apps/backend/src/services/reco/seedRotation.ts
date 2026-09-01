/** Une entrée candidate au tirage quotidien : clé et force relative. */
export interface RotationEntry {
  key: string;
  strength: number;
}

/** FNV-1a 32 bits — stable, sans dépendance. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 : PRNG déterministe — largement assez pour un tirage d'affichage. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jour UTC (AAAA-MM-JJ) : le même sur tous les appareils du compte. */
export function utcDayStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Tirage pondéré SANS remise de `count` entrées, déterministe pour
 * (userId, jour UTC) : les rangées tournantes (« Parce que vous avez aimé »,
 * « Avec {acteur} ») changent chaque jour sans invalider le pool (6 h), et
 * deux requêtes du même jour montrent exactement la même chose.
 */
export function pickDaily<T extends RotationEntry>(
  entries: T[],
  userId: string,
  count: number,
  dayStamp = utcDayStamp()
): T[] {
  if (entries.length <= count) return [...entries];
  const rand = mulberry32(fnv1a(`${userId}:${dayStamp}`));
  const remaining = [...entries];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    // Plancher 0.01 : une force nulle reste tirable, jamais division par zéro.
    const total = remaining.reduce((sum, e) => sum + Math.max(e.strength, 0.01), 0);
    let roll = rand() * total;
    let index = 0;
    for (; index < remaining.length - 1; index++) {
      roll -= Math.max(remaining[index].strength, 0.01);
      if (roll <= 0) break;
    }
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}
