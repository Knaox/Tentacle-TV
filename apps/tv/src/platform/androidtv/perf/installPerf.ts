import { countCommit, perfLabelOf, type FiberLike } from "@tentacle-tv/tv-core/render";
import { navigationRef } from "../../../navigation/navigationRef";
import { androidTvInput } from "../input";
import { PERF_ENABLED, perfCommit, perfMark } from "./perfNative";

/**
 * Le branchement du mode de mesure (`perfNative`), au tout début du
 * chargement — AVANT le moteur de React Native, qui ne regarde qu'une fois
 * s'il existe un crochet d'outils de développement :
 *
 * - le CROCHET de React (`__REACT_DEVTOOLS_GLOBAL_HOOK__`) : React l'appelle à
 *   chaque validation, même en production ; on y compte les composants rendus
 *   et les vues créées ou changées (tv-core `countCommit`) ;
 * - les GESTES de la télécommande (observés, jamais pris) et l'ÉCRAN courant
 *   nomment les fenêtres d'images du journal.
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
    screen = name;
    perfMark(`écran:${name}`);
  });
}
