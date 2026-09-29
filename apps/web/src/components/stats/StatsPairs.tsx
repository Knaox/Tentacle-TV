import type { ReactNode } from "react";

/**
 * Deux cartes par rangée au bureau ; une carte seule (l'autre n'a rien à
 * dire) prend toute la largeur au lieu de laisser un trou. Les cartes sans
 * rien à montrer ne sont pas montées.
 */
export function StatsPairs({ cards }: { cards: Array<[visible: boolean, node: ReactNode]> }) {
  const shown = cards.filter(([visible]) => visible).map(([, node]) => node);
  if (shown.length === 0) return null;
  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-2 lg:items-start lg:[&>*:last-child:nth-child(odd)]:col-span-2">{shown}</div>
  );
}
