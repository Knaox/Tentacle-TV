/**
 * Octave — une étagère de cartes qui tient en `rows` rangées PLEINES : autant
 * de cartes que la largeur en montre, jamais une carte orpheline sur une
 * rangée de plus. Les cartes qui ne tiennent pas ne sont pas montées (ni image
 * chargée, ni rien) ; « Tout afficher » mène au reste.
 */

import { useRef, type ReactNode } from "react";
import { CARD_GRID_CLASS, useGridColumns } from "./cardGrid";

interface CardRowProps<T> {
  items: readonly T[];
  rows?: number;
  render: (item: T) => ReactNode;
}

export function CardRow<T>({ items, rows = 1, render }: CardRowProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(ref);
  return (
    <div ref={ref} className={CARD_GRID_CLASS}>
      {items.slice(0, columns * rows).map(render)}
    </div>
  );
}

/** La même étagère en attente : des cartes vides à la place exacte des vraies. */
export function CardRowSkeleton({ rows = 1, round = false }: { rows?: number; round?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(ref);
  return (
    <div ref={ref} aria-hidden className={CARD_GRID_CLASS}>
      {Array.from({ length: columns * rows }, (_, i) => (
        <CardSkeleton key={i} round={round} />
      ))}
    </div>
  );
}

/** Une carte en attente : pochette, titre, sous-titre — les mesures d'une vraie carte. */
export function CardSkeleton({ round = false }: { round?: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className={`aspect-square w-full bg-fill-soft ${round ? "rounded-full" : "rounded-md"}`} />
      <div className={`flex flex-col px-0.5 ${round ? "items-center" : ""}`}>
        <div className="flex h-5 w-3/4 items-center">
          <div className="h-3.5 w-full rounded bg-fill-soft" />
        </div>
        <div className="flex h-5 w-1/2 items-center">
          <div className="h-3 w-full rounded bg-fill-subtle" />
        </div>
      </div>
    </div>
  );
}
