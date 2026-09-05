import { useEffect, useState } from "react";
import type { JellyfinClient, RecoPage } from "@tentacle-tv/api-client";
import { warmRecoImages } from "../../lib/recoPrefetch";

/** Budget d'attente des affiches avant l'échange — au-delà, on échange quand même. */
export const SETTLE_BUDGET_MS = 350;
const SETTLE_ROWS = 2;
const SETTLE_PER_ROW = 8;

type RowsOnly = { rows: ReadonlyArray<{ items: ReadonlyArray<{ key: string }> }> };

/**
 * Vrai si la page suivante peut remplacer l'actuelle sans attendre : rien
 * n'est affiché encore, ou aucune affiche NOUVELLE dans la fenêtre de
 * préchauffe (retrait d'un titre, rafraîchissement silencieux du même filtre).
 */
export function canSwapImmediately(shown: RowsOnly | undefined, next: RowsOnly): boolean {
  if (!shown) return true;
  const known = new Set<string>();
  for (const row of shown.rows) for (const item of row.items) known.add(item.key);
  for (const row of next.rows.slice(0, SETTLE_ROWS)) {
    for (const item of row.items.slice(0, SETTLE_PER_ROW)) if (!known.has(item.key)) return false;
  }
  return true;
}

/**
 * La page AFFICHÉE suit la page SERVIE avec une latence bornée : quand une
 * page à contenu nouveau arrive (changement de filtre), ses premières affiches
 * sont préchargées (au plus SETTLE_BUDGET_MS) AVANT l'échange — les rangées
 * apparaissent habillées, jamais en cases vides qui se remplissent. La toute
 * première page, elle, s'affiche immédiatement.
 */
export function useSettledRecoPage(
  page: RecoPage | undefined,
  client: JellyfinClient
): { page: RecoPage | undefined; settling: boolean } {
  const [shown, setShown] = useState<RecoPage | undefined>(page);
  useEffect(() => {
    if (!page) {
      if (shown) setShown(undefined);
      return;
    }
    if (page === shown) return;
    if (canSwapImmediately(shown, page)) {
      setShown(page);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const swap = () => {
      if (!cancelled) setShown(page);
    };
    const budget = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SETTLE_BUDGET_MS);
    });
    void Promise.race([warmRecoImages(page, client, { rows: SETTLE_ROWS, perRow: SETTLE_PER_ROW }), budget]).then(
      swap,
      swap
    );
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [page, shown, client]);
  const current = page ? (shown ?? page) : undefined;
  return { page: current, settling: current !== page };
}
