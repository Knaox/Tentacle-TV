/**
 * Le côté « banc » du canal de pilotage : l'état (scène, focus figé, verre,
 * langue) vit dans le relais ; le banc l'écoute en attente longue et y écrit
 * ses propres changements (menu, interrupteurs). La ligne de commande
 * (`bench.mjs`) écrit au même endroit : d'où qu'il vienne, un changement
 * arrive ici par le même chemin.
 */

export type BenchLang = "fr" | "en";

export interface BenchState {
  rev: number;
  /** L'identifiant de la scène affichée ; `null` = le catalogue. */
  scene: string | null;
  /** La clé de l'élément dessiné focalisé ; `null` = focus natif. */
  focus: string | null;
  /** Liquid Glass demandé (défaut), sinon verre enrichi. */
  glass: boolean;
  /** Faux : Liquid Glass SIMULÉ même là où le verre natif existe — le repli
   *  des tvOS < 26, montré sur un simulateur tvOS 26. */
  nativeGlass: boolean;
  lang: BenchLang;
}

/** L'adresse d'où l'app a chargé son code : le relais du banc. */
export const BENCH_ORIGIN: string = require("react-native/Libraries/Core/Devtools/getDevServer").default().url;

let state: BenchState = { rev: -1, scene: null, focus: null, glass: true, nativeGlass: true, lang: "fr" };
const listeners = new Set<() => void>();

function commit(next: BenchState) {
  if (next.rev < state.rev) return;
  state = next;
  for (const listener of listeners) listener();
}

export const getBenchState = (): BenchState => state;

export function subscribeBench(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Change l'état depuis le banc : tout de suite ici, puis au relais, qui
 *  rend la révision officielle. */
export function patchBench(patch: Partial<Omit<BenchState, "rev">>): void {
  commit({ ...state, ...patch });
  fetch(`${BENCH_ORIGIN}bench/control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...patch, from: "bench" }),
  })
    .then((res) => res.json())
    .then((next: BenchState) => commit(next))
    .catch(() => undefined);
}

/** Dit au relais que la révision `rev` est à l'écran : la capture peut partir. */
export function signalReady(rev: number): void {
  fetch(`${BENCH_ORIGIN}bench/ready`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rev }),
  }).catch(() => undefined);
}

/** Publie la liste des scènes : la ligne de commande la lit pour « next »,
 *  « prev » et les planches. */
export function publishScenes(list: Array<{ id: string; group: string; label: string; focusKeys: string[] }>): void {
  fetch(`${BENCH_ORIGIN}bench/scenes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(list),
  }).catch(() => undefined);
}

let polling = false;

/** L'écoute du relais. Une seule boucle par processus JS ; elle s'arrête avec
 *  lui (un rechargement repart de l'état du relais : la scène survit). */
export function startBenchPolling(): void {
  if (polling) return;
  polling = true;
  const loop = async () => {
    for (;;) {
      try {
        const res = await fetch(`${BENCH_ORIGIN}bench/control?since=${state.rev}`);
        commit((await res.json()) as BenchState);
      } catch {
        // Relais coupé : on réessaie sans marteler.
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  };
  void loop();
}
