import { useSyncExternalStore } from "react";

/**
 * L'état du lecteur téléviseur, hors de l'arbre React.
 *
 * Trois lecteurs de cet état ne sont pas des composants : le moteur de focus,
 * qui doit savoir s'il a le droit de déplacer le focus sur cette route ; les
 * touches de transport globales, qui doivent se taire quand le lecteur est
 * monté ; et le contrôleur de touches lui-même, installé en capture sur le
 * document. Un contexte React ne leur servirait à rien. C'est le motif du
 * magasin externe, déjà employé par `usePinnedNav` et `useUserId`.
 *
 * **Le mode décide de tout.** `repos` : rien d'affiché, les flèches entrent
 * dans le déplacement du flux. `osd` : les commandes sont visibles, les flèches
 * appartiennent au moteur de focus. `scrub` : un curseur fantôme avance seul,
 * la vidéo est en pause, et aucun déplacement n'est appliqué avant
 * confirmation. Un seul propriétaire par touche, déduit de l'état — pas de
 * l'ordre d'installation des écouteurs.
 *
 * L'instantané ne change de référence que si quelque chose a changé : React
 * boucle sur « The result of getSnapshot should be cached » à la moindre
 * fabrication d'objet.
 */

export type PlayerMode = "idle" | "osd" | "scrub";
export type OpenPanel = "none" | "tracks" | "episodes";

export interface SharedScrubState {
  position: number;
  tier: number;
}

export interface TvPlayerState {
  mounted: boolean;
  mode: PlayerMode;
  panel: OpenPanel;
  scrub: SharedScrubState | null;
}

/** Cinq secondes : le temps de lire un titre sans que l'habillage s'installe. */
const AUTOHIDE_MS = 5000;

const INITIAL: TvPlayerState = { mounted: false, mode: "osd", panel: "none", scrub: null };

let state: TvPlayerState = INITIAL;
let playing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<TvPlayerState>): void {
  const merged: TvPlayerState = { ...state, ...next };
  if (
    merged.mounted === state.mounted &&
    merged.mode === state.mode &&
    merged.panel === state.panel &&
    merged.scrub === state.scrub
  ) {
    return;
  }
  state = merged;
  listeners.forEach((listener) => listener());
}

function stopTimer(): void {
  if (timer === null) return;
  clearTimeout(timer);
  timer = null;
}

/**
 * Le masquage n'est armé qu'en lecture et hors panneau : une pause épingle les
 * commandes — c'est le retour visuel qu'on attend d'un lecteur — et un panneau
 * ouvert n'a aucune raison de disparaître sous le doigt.
 */
function armAutoHide(): void {
  stopTimer();
  if (!playing || state.panel !== "none" || state.mode !== "osd") return;
  timer = setTimeout(() => {
    timer = null;
    set({ mode: "idle" });
  }, AUTOHIDE_MS);
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function readState(): TvPlayerState {
  return state;
}

export function useTvPlayerState(): TvPlayerState {
  return useSyncExternalStore(subscribe, readState);
}

export function setMounted(mounted: boolean): void {
  if (!mounted) {
    stopTimer();
    playing = false;
    set({ mounted: false, mode: "osd", panel: "none", scrub: null });
    return;
  }
  set({ mounted: true, mode: "osd", panel: "none", scrub: null });
  armAutoHide();
}

export function setPlaying(next: boolean): void {
  if (playing === next) return;
  playing = next;
  armAutoHide();
}

export function showOsd(): void {
  if (state.mode === "scrub") return;
  set({ mode: "osd" });
  armAutoHide();
}

/**
 * Repousse l'extinction sans toucher au mode.
 *
 * `showOsd()` FORCE le mode à `osd` — ce n'est pas ce qu'on veut d'un simple
 * déplacement de focus, qui doit dire « je suis là » sans rien décider. Sans ce
 * report, le minuteur armé au dernier `showOsd()` expirait sous les doigts :
 * l'habillage s'éteignait en pleine navigation, au bout de cinq secondes comptées
 * depuis son apparition et non depuis le dernier geste. La flèche encore tenue
 * se retrouvait alors du côté `repos`, où elle entre dans le flux.
 */
export function deferAutoHide(): void {
  if (state.mode !== "osd") return;
  armAutoHide();
}

export function enterScrub(position: number, tier: number): void {
  stopTimer();
  set({ mode: "scrub", panel: "none", scrub: { position, tier } });
}

export function updateScrub(position: number, tier: number): void {
  if (state.mode !== "scrub") return;
  set({ scrub: { position, tier } });
}

export function exitScrub(): void {
  set({ mode: "osd", scrub: null });
  armAutoHide();
}

export function setPanel(panel: OpenPanel): void {
  set({ panel, mode: panel === "none" ? state.mode : "osd" });
  armAutoHide();
}

/** Le lecteur téléviseur est-il monté ? Lu par les touches globales. */
export function tvPlayerActive(): boolean {
  return state.mounted;
}

/**
 * Le moteur de focus a-t-il le droit d'agir sur la route du lecteur ?
 *
 * Oui quand les commandes sont visibles — ce sont des boutons comme les autres,
 * et le moteur les parcourt sans qu'on écrive une ligne. Non le reste du temps :
 * les flèches y appartiennent au déplacement dans le flux.
 */
export function osdNavigationActive(): boolean {
  return state.mounted && state.mode === "osd";
}
