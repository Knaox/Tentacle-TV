import { runOnJS, runOnUI } from "react-native-reanimated";
import { countCommit, PERF_SAMPLING, perfLabelOf, type FiberLike } from "@tentacle-tv/tv-core/render";
import { navigationRef } from "../../../navigation/navigationRef";
import { androidTvInput } from "../input";
import { PERF_ENABLED, perfCommit, perfMark, perfReanimated } from "./perfNative";

/**
 * Le branchement du mode de mesure (`perfNative`), au tout début du
 * chargement — AVANT le moteur de React Native, qui ne regarde qu'une fois
 * s'il existe un crochet d'outils de développement :
 *
 * - le CROCHET de React (`__REACT_DEVTOOLS_GLOBAL_HOOK__`) : React l'appelle à
 *   chaque validation, même en production ; on y compte les composants rendus
 *   et les vues créées ou changées (tv-core `countCommit`) ;
 * - les GESTES de la télécommande (observés, jamais pris) et l'ÉCRAN courant
 *   nomment les fenêtres d'images du journal ;
 * - les mises à jour de vues que REANIMATED envoie au natif à chaque image
 *   (`_updatePropsPaper`, enveloppé sur son runtime d'interface) : le premier
 *   poste du fil UI pendant une animation.
 *
 * Éteint (le cas de toute build livrée, sauf propriété posée), rien n'est
 * installé.
 */

interface CommitRoot {
  current: FiberLike;
}

interface DevToolsHook {
  supportsFiber: boolean;
  isDisabled?: boolean;
  inject(internals: unknown): number;
  onCommitFiberRoot(rendererId: number, root: CommitRoot, ...rest: unknown[]): void;
  onCommitFiberUnmount?(...args: unknown[]): void;
  onPostCommitFiberRoot?(...args: unknown[]): void;
  checkDCE?(...args: unknown[]): void;
}

const HOOK = "__REACT_DEVTOOLS_GLOBAL_HOOK__";

function onCommit(root: CommitRoot): void {
  const current = root.current;
  const count = countCommit(current, current.alternate);
  perfCommit(count.components, count.hostMounts, count.hostUpdates);
}

/** Le crochet : le nôtre, ou celui des outils de développement (build debug), prolongé. */
function installCommitHook(): void {
  const scope = globalThis as unknown as Record<string, DevToolsHook | undefined>;
  const existing = scope[HOOK];
  if (existing) {
    const previous = existing.onCommitFiberRoot.bind(existing);
    existing.onCommitFiberRoot = (rendererId, root, ...rest) => {
      previous(rendererId, root, ...rest);
      onCommit(root);
    };
    return;
  }
  let renderers = 0;
  scope[HOOK] = {
    supportsFiber: true,
    isDisabled: false,
    inject: () => ++renderers,
    onCommitFiberRoot: (_rendererId, root) => onCommit(root),
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
    checkDCE: () => {},
  };
}

/**
 * Les mises à jour de Reanimated, comptées sur son runtime d'interface :
 * chaque image, `UpdatePropsManager.flush` envoie ses opérations par
 * `_updatePropsPaper` — enveloppé ici, relevé tous les
 * `PERF_SAMPLING.reanimatedReportMs`. Lancé au premier écran : Reanimated est
 * alors prêt (et ses imports, inlinés par Metro, ne se chargent qu'ici —
 * jamais avant le moteur de React).
 */
function countReanimatedUpdates(): void {
  runOnUI(() => {
    "worklet";
    const scope = globalThis as unknown as Record<string, unknown>;
    if (scope.__tentaclePerfOps !== undefined) return;
    scope.__tentaclePerfOps = 0;
    scope.__tentaclePerfFlushes = 0;
    const original = scope._updatePropsPaper as (operations: unknown[]) => void;
    scope._updatePropsPaper = (operations: unknown[]) => {
      scope.__tentaclePerfOps = (scope.__tentaclePerfOps as number) + operations.length;
      scope.__tentaclePerfFlushes = (scope.__tentaclePerfFlushes as number) + 1;
      original(operations);
    };
  })();
  setInterval(() => {
    runOnUI(() => {
      "worklet";
      const scope = globalThis as unknown as Record<string, number>;
      const updates = scope.__tentaclePerfOps;
      const flushes = scope.__tentaclePerfFlushes;
      if (!updates) return;
      scope.__tentaclePerfOps = 0;
      scope.__tentaclePerfFlushes = 0;
      runOnJS(perfReanimated)(updates, flushes);
    })();
  }, PERF_SAMPLING.reanimatedReportMs);
}

if (PERF_ENABLED) {
  installCommitHook();
  androidTvInput.observe(({ intent }) => {
    const label = perfLabelOf(intent);
    if (label) perfMark(label);
  });
  let screen: string | undefined;
  navigationRef.addListener("state", () => {
    const name = navigationRef.getCurrentRoute()?.name;
    if (!name || name === screen) return;
    if (screen === undefined) countReanimatedUpdates();
    screen = name;
    perfMark(`écran:${name}`);
  });
}
