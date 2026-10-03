import "./runtime";
import { detailEntries } from "./scenarios/detail";
import { entryFocus } from "./scenarios/entry";
import { entryGuides, keepWithin } from "./scenarios/guides";
import { beyondEdge, heroRotation } from "./scenarios/remote";
import { restoreClaims, storeClaims, storeTracking } from "./scenarios/store";
import { resetClock, takeTrace } from "./runtime";

/**
 * Le banc de traces du focus : les applicateurs du focus (magasin, reprise,
 * guide d'entrée, garde, entrée d'écran, bord, rotation du héros, entrées de
 * la fiche), montés sans DOM ni simulateur, sous une horloge factice. Chaque
 * scénario rend sa trace ; `bench.mjs` les joue sur l'arbre de référence et sur
 * l'arbre courant, et compare.
 */

const scenarios: Record<string, () => unknown[]> = {
  storeTracking,
  storeClaims,
  restoreClaims,
  entryGuides,
  keepWithin,
  entryFocus,
  beyondEdge,
  heroRotation,
  detailEntries,
};

const traces: Record<string, unknown> = {};
for (const [name, run] of Object.entries(scenarios)) {
  resetClock();
  takeTrace();
  try {
    traces[name] = run();
  } catch (error) {
    traces[name] = { error: String((error as Error)?.stack ?? error) };
  }
}
process.stdout.write(JSON.stringify({ scenarios: traces }));
