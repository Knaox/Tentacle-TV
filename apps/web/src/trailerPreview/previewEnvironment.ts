import { useSyncExternalStore } from "react";
import { isDataSaverActive, subscribeDataSaver } from "@tentacle-tv/api-client";
import { trailerPreviewsFlag } from "./previewSettings";

/**
 * Ce qui, sur CET appareil et en ce moment, interdit tout aperçu — calculé une
 * fois pour toute l'app, lu par chaque carte en UN booléen : un appareil où
 * l'aperçu n'a pas sa place ne demande rien, ne charge rien, n'anime rien.
 *
 *   - `setting` : « Aperçus de bande-annonce au survol » coupé ;
 *   - `offline` : l'app est hors ligne (bureau) — rien à relayer ;
 *   - `mirror` : la mise en page du téléphone ou de la tablette (miroir) ;
 *   - `hidden` : la page n'est pas affichée (onglet, fenêtre réduite) ;
 *   - `pointer` : pas de souris — un écran tactile ne survole pas ;
 *   - `reducedData` : le système demande d'économiser les données ;
 *   - `dataSaver` : l'économie de données de Tentacle est active.
 *
 * Ni « Réduire les animations » (l'aperçu reste, sa mini-carte s'anime moins),
 * ni la capacité du serveur et le PiP (lus par le crochet de chaque carte).
 */
export type TrailerPreviewBlock = "setting" | "offline" | "mirror" | "hidden" | "pointer" | "reducedData" | "dataSaver";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_DATA_QUERY = "(prefers-reduced-data: reduce)";

/** Ce que l'app pousse depuis ses propres magasins (`TrailerPreviewBinding`). */
export interface TrailerPreviewHostState {
  offline: boolean;
  mirror: boolean;
}

let host: TrailerPreviewHostState = { offline: false, mirror: false };
let block: TrailerPreviewBlock | null = null;
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

function matches(query: string, fallback: boolean): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return fallback;
  return window.matchMedia(query).matches;
}

function compute(): TrailerPreviewBlock | null {
  if (!trailerPreviewsFlag.get()) return "setting";
  if (host.offline) return "offline";
  if (host.mirror) return "mirror";
  if (typeof document !== "undefined" && document.hidden) return "hidden";
  if (!matches(FINE_POINTER_QUERY, true)) return "pointer";
  if (matches(REDUCED_DATA_QUERY, false)) return "reducedData";
  if (isDataSaverActive()) return "dataSaver";
  return null;
}

function refresh(): void {
  const next = compute();
  if (next === block) return;
  block = next;
  for (const listener of listeners) listener();
}

/** Les sources du navigateur ne sont écoutées que tant qu'une carte écoute. */
function attach(): () => void {
  const unsubscribers = [trailerPreviewsFlag.subscribe(refresh), subscribeDataSaver(refresh)];
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", refresh);
    unsubscribers.push(() => document.removeEventListener("visibilitychange", refresh));
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    for (const query of [FINE_POINTER_QUERY, REDUCED_DATA_QUERY]) {
      const list = window.matchMedia(query);
      list.addEventListener?.("change", refresh);
      unsubscribers.push(() => list.removeEventListener?.("change", refresh));
    }
  }
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

export function subscribeTrailerPreviewBlock(listener: () => void): () => void {
  if (listeners.size === 0) {
    detach = attach();
    block = compute();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detach?.();
      detach = null;
    }
  };
}

/** Le blocage courant (`null` : rien ne bloque). Recalculé à la lecture tant que personne n'écoute. */
export function getTrailerPreviewBlock(): TrailerPreviewBlock | null {
  return listeners.size > 0 ? block : compute();
}

/** L'état de l'app que le module ne peut pas lire seul (connectivité, gabarit), poussé par la liaison. */
export function setTrailerPreviewHostState(next: TrailerPreviewHostState): void {
  if (next.offline === host.offline && next.mirror === host.mirror) return;
  host = { ...next };
  refresh();
}

/** Le blocage de l'appareil, en direct — un seul abonnement par carte. */
export function useTrailerPreviewBlock(): TrailerPreviewBlock | null {
  return useSyncExternalStore(subscribeTrailerPreviewBlock, getTrailerPreviewBlock, getTrailerPreviewBlock);
}
