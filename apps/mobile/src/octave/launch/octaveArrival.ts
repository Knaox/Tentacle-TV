/**
 * Octave (mobile) — un lien d'Octave reçu app DÉJÀ ouverte (partage système : Shazam, playlist, Bandcamp,
 * fichiers ; `tentacle://octave/…`) pendant qu'on était dans TENTACLE : une modale ouverte (recherche, fiche,
 * lecteur…) présentait Octave DANS sa feuille, Tentacle dessous (lot « fl », 30/10, mesuré au simulateur). Avant que
 * le routeur ne traite le lien (`+native-intent`), la pile racine revient à sa base : Octave arrive sur Tentacle,
 * jamais dans une modale. Réinitialiser APRÈS ne va pas : react-native-screens remonte Octave hors de la feuille, et
 * sa pile repart sur l'accueil (mesuré). Règle pure (`rootBaseState`) ; le geste, un `RESET` de la pile racine.
 */

/** Un chemin d'Octave (`octave/…`, `/octave/…`, `tentacle://octave/…`). */
export function isOctaveLink(path: string): boolean {
  return /^(?:tentacle:\/\/|\/)?octave(?:[/?#]|$)/.test(path);
}

export interface StackRoute {
  name: string;
}

export interface StackState<R extends StackRoute = StackRoute> {
  key: string;
  index: number;
  routes: R[];
}

/** La pile racine ramenée à sa base ; `null` si rien n'est empilé, ou si Octave est déjà devant. */
export function rootBaseState<S extends StackState>(stack: S, octaveName = "octave"): S | null {
  if (stack.routes.length <= 1 || stack.routes[stack.index]?.name === octaveName) return null;
  return { ...stack, index: 0, routes: [stack.routes[0]] };
}

interface RootRef {
  isReady(): boolean;
  getRootState(): { routes: { state?: unknown }[] } | undefined;
  dispatch(action: { type: "RESET"; payload: StackState; target: string }): void;
}

/** Ferme ce que Tentacle a empilé (modales comprises) avant l'arrivée d'un lien d'Octave. */
export function clearTentacleAbove(ref: RootRef | null | undefined): void {
  if (!ref?.isReady()) return;
  // `__root` (la mise en page racine d'expo-router), puis SA pile : celle de `app/_layout.tsx`.
  const stack = ref.getRootState()?.routes[0]?.state as StackState | undefined;
  if (!stack || typeof stack.key !== "string" || !Array.isArray(stack.routes)) return;
  const next = rootBaseState(stack);
  if (next) ref.dispatch({ type: "RESET", payload: next, target: stack.key });
}
