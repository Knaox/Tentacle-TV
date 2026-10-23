/**
 * Le budget de lentilles de la PAGE (`allocateLenses`, `gpuBudget.ts`) : chaque
 * verre qui veut une lentille s'inscrit ici avec son élément ; un seul
 * `IntersectionObserver` dit lesquels sont à l'écran ; l'allocation est
 * refaite à chaque arrivée, départ ou entrée dans le champ, et seuls les
 * verres dont le sort change sont prévenus.
 *
 * L'inscription mesure l'élément TOUT DE SUITE (dans l'effet de mise en page
 * qui l'appelle) : un verre qui naît sous le budget a sa lentille dès sa
 * première image, sans passer par le givre.
 */

import { allocateLenses, LENS_BUDGET, type LensCandidate, type LensRank } from "./gpuBudget";

interface Entry extends LensCandidate {
  element: Element;
}

const entries = new Map<string, Entry>();
const byElement = new Map<Element, string>();
const listeners = new Set<() => void>();
let granted = new Set<string>();
let counter = 0;
let observer: IntersectionObserver | null | undefined;

function onScreen(rect: DOMRectReadOnly | DOMRect): boolean {
  if (typeof window === "undefined") return true;
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function reallocate(): void {
  const next = allocateLenses([...entries.values()], LENS_BUDGET);
  const changed = next.size !== granted.size || [...next].some((id) => !granted.has(id));
  granted = next;
  if (changed) for (const listener of listeners) listener();
}

function sharedObserver(): IntersectionObserver | null {
  if (observer !== undefined) return observer;
  observer =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((records) => {
          let moved = false;
          for (const record of records) {
            const id = byElement.get(record.target);
            const entry = id === undefined ? undefined : entries.get(id);
            if (entry === undefined) continue;
            const area = record.boundingClientRect.width * record.boundingClientRect.height;
            if (entry.visible !== record.isIntersecting || entry.area !== area) moved = true;
            entry.visible = record.isIntersecting;
            entry.area = area;
          }
          if (moved) reallocate();
        });
  return observer;
}

/** Le rang d'un verre : une surface, le chrome de la fenêtre (barre du haut), ou un contrôle. */
export function lensRankOf(element: Element, surface: boolean): LensRank {
  if (surface) return "surface";
  return element.closest("header, [data-lg-chrome]") !== null ? "chrome" : "control";
}

/** Inscrit un verre qui veut sa lentille ; rend de quoi le désinscrire. */
export function registerLens(id: string, element: Element, rank: LensRank): () => void {
  const rect = element.getBoundingClientRect();
  entries.set(id, { id, element, rank, visible: onScreen(rect), area: rect.width * rect.height, order: counter++ });
  byElement.set(element, id);
  sharedObserver()?.observe(element);
  reallocate();
  return () => {
    entries.delete(id);
    if (byElement.get(element) === id) {
      byElement.delete(element);
      observer?.unobserve(element);
    }
    reallocate();
  };
}

export function lensGranted(id: string): boolean {
  return granted.has(id);
}

export function subscribeLensBudget(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Les verres inscrits et ceux qui gardent leur lentille (bancs, tests). */
export function lensBudgetSnapshot(): { registered: number; visible: number; granted: number } {
  const all = [...entries.values()];
  return { registered: all.length, visible: all.filter((e) => e.visible).length, granted: all.filter((e) => granted.has(e.id)).length };
}
