/* ------------------------------------------------------------------ */
/*  Ce que le relais oublie, et comment — une règle pure                */
/*                                                                     */
/*  Une vidéo résolue pèse deux choses : sa SOURCE (l'URL du maître    */
/*  googlevideo et ses en-têtes, quelques Ko), qui coûte une           */
/*  extraction YouTube, et ses LISTES lues (maître, listes de          */
/*  segments, sous-titres convertis), jusqu'à une centaine de Ko, qui  */
/*  se relisent chez googlevideo sans rien demander à YouTube.         */
/*                                                                     */
/*  Au-delà de `full` vidéos complètes, les plus anciennes perdent     */
/*  leurs listes mais GARDENT leur source jusqu'à son échéance : un    */
/*  aperçu qui revient sur un titre, même après cent autres, ne coûte  */
/*  jamais une nouvelle extraction tant que ses URL valent. Au-delà de */
/*  `total` sources, les plus anciennes partent ; une source échue     */
/*  part toujours.                                                     */
/* ------------------------------------------------------------------ */

export interface EvictionView {
  /** Dernier usage (ms) : les moins récentes partent les premières. */
  lastUsed: number;
  /** Échéance des URL amont (ms). */
  validUntil: number;
  /** Ses listes sont en mémoire (maître lu, listes, sous-titres) : elle pèse. */
  full: boolean;
}

export interface EvictionLimits {
  /** Vidéos complètes gardées. */
  full: number;
  /** Sources gardées en tout (complètes comprises). */
  total: number;
}

export interface EvictionPlan {
  /** À réduire à leur source. */
  slim: string[];
  /** À oublier tout à fait. */
  drop: string[];
}

export function planEviction(entries: ReadonlyMap<string, EvictionView>, now: number, limits: EvictionLimits): EvictionPlan {
  const drop: string[] = [];
  const kept: Array<[string, EvictionView]> = [];
  for (const [id, view] of entries) {
    if (view.validUntil <= now) drop.push(id);
    else kept.push([id, view]);
  }
  // Les plus récentes d'abord : on garde le début, on taille la fin.
  kept.sort((a, b) => b[1].lastUsed - a[1].lastUsed);
  const slim: string[] = [];
  let full = 0;
  kept.forEach(([id, view], index) => {
    if (index >= limits.total) {
      drop.push(id);
      return;
    }
    if (!view.full) return;
    full++;
    if (full > limits.full) slim.push(id);
  });
  return { slim, drop };
}

/** Ce que l'oubli touche d'une vidéo du relais (`trailerRelay.ts`, `Entry`). */
export interface EvictableEntry {
  lastUsed: number;
  validUntil: number;
  master?: unknown;
  masterText?: string;
  fixedMasters: Map<number, string>;
  media: Map<string, unknown>;
  subtitleTexts: Map<string, string>;
}

const isFull = (entry: EvictableEntry) => entry.master !== undefined || entry.media.size > 0 || entry.subtitleTexts.size > 0;

/** Applique la règle à la mémoire du relais : sources échues ou en trop oubliées, listes des plus anciennes relâchées. */
export function evictEntries(entries: Map<string, EvictableEntry>, now: number, limits: EvictionLimits): void {
  const views = new Map([...entries].map(([id, e]) => [id, { lastUsed: e.lastUsed, validUntil: e.validUntil, full: isFull(e) }]));
  const plan = planEviction(views, now, limits);
  for (const id of plan.drop) entries.delete(id);
  for (const id of plan.slim) {
    const entry = entries.get(id);
    if (!entry) continue;
    // Ses listes se relisent chez googlevideo à la demande ; sa source, elle, reste.
    entry.master = undefined;
    entry.masterText = undefined;
    entry.fixedMasters.clear();
    entry.media.clear();
    entry.subtitleTexts.clear();
  }
}
