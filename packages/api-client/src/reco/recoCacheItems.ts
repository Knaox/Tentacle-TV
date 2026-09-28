import type { QueryClient } from "@tanstack/react-query";
import type { RecoRowItem } from "../hooks/recoTypes";
import { RECO_PAGE_KEY, dropRecoItemEverywhere, type RecoPage } from "../hooks/useRecoPage";
import { isRecoItemHeld } from "./recoRetirementState";

// Lecture des pages de recommandations en cache — sans rien savoir des notes
// ni des marqueurs, pour que `useRatings` puisse s'en servir sans boucle
// d'import (cf. recoRetirement.ts).

/** Les recommandations en cache qui désignent cette carte — par clé ou par item. */
export function recoItemsOf(qc: QueryClient, id: string): RecoRowItem[] {
  const found = new Map<string, RecoRowItem>();
  for (const [, page] of qc.getQueriesData<RecoPage>({ queryKey: [RECO_PAGE_KEY] })) {
    for (const row of page?.rows ?? []) {
      for (const item of row.items) {
        if (item.key === id || item.jellyfinItemId === id) found.set(item.key, item);
      }
    }
  }
  return [...found.values()];
}

/**
 * Le retrait optimiste d'une NOTE : tout de suite si personne ne tient le
 * titre (la note vient de sa fiche, d'une fin de lecture…), au lâcher sinon —
 * c'est alors la note, déjà dans le cache, qui le juge.
 */
export async function dropRecoItemUnlessHeld(qc: QueryClient, key: string): Promise<void> {
  const held = isRecoItemHeld({ key }) || recoItemsOf(qc, key).some(isRecoItemHeld);
  if (!held) await dropRecoItemEverywhere(qc, key);
}
