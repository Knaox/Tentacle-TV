import { memo, type ReactNode } from "react";

export interface TooltipRow {
  /** Couleur de la marque, en trait court (jamais une boîte pleine). */
  color?: string;
  label: string;
  value: string;
}

interface ChartTooltipProps {
  /** Position de la pointe, en px dans le conteneur relatif du graphique. */
  x: number;
  y: number;
  /** Largeur du conteneur : l'infobulle ne déborde jamais du graphique. */
  containerWidth: number;
  title: string;
  /** La valeur mise en avant (le total), avant les lignes par série. */
  headline?: string;
  rows?: TooltipRow[];
  footer?: ReactNode;
}

const WIDTH = 200;

/**
 * L'infobulle des graphiques : la valeur d'abord, forte ; le libellé ensuite.
 * Les séries sont repérées par un trait de leur couleur, le texte garde les
 * encres du thème. Tout est rendu en nœuds texte React — jamais de HTML
 * injecté, les titres viennent de la bibliothèque.
 *
 * Elle AGRÉMENTE : chaque valeur se retrouve aussi dans la vue « tableau ».
 */
export const ChartTooltip = memo(function ChartTooltip({ x, y, containerWidth, title, headline, rows, footer }: ChartTooltipProps) {
  const left = Math.max(0, Math.min(containerWidth - WIDTH, x - WIDTH / 2));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 rounded-xl bg-[color:var(--surface-3)] px-3 py-2.5 shadow-[var(--elev-2)] ring-1 ring-line-strong"
      style={{ left, top: Math.max(0, y), width: WIDTH, transform: "translateY(-100%)" }}
    >
      {headline && <p className="text-base font-semibold tabular-nums text-content-primary">{headline}</p>}
      <p className="text-xs text-content-tertiary">{title}</p>
      {rows && rows.length > 0 && (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-xs">
              {r.color && <span aria-hidden className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: r.color }} />}
              <span className="min-w-0 flex-1 truncate text-content-secondary">{r.label}</span>
              <span className="font-semibold tabular-nums text-content-primary">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </div>
  );
});
