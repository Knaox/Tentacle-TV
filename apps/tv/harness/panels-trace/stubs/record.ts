/**
 * Le carnet du banc : ce que les doublures voient passer — les props des vues
 * natives rendues, et des événements datés par pas de scénario.
 */

type Props = Record<string, unknown>;

const bench = globalThis as unknown as { __hosts?: Map<string, Props>; __events?: unknown[] };
bench.__hosts ??= new Map();
bench.__events ??= [];

export const hosts = bench.__hosts;
export const events = bench.__events;

export function note(event: unknown): void {
  events.push(event);
}

/** Les props sans les fonctions ni les enfants : ce qui se compare d'un arbre à l'autre. */
export function plain(props: Props): Props {
  const out: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || typeof value === "function") continue;
    out[key] = value;
  }
  return out;
}
