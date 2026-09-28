import { memo } from "react";
import type { ViewingStatsSplit } from "@tentacle-tv/shared";
import { useStatsFormat } from "./useStatsFormat";

/**
 * Trois natures, trois couleurs, dans un ordre FIXE : la marque, l'accent,
 * l'ambre. Validé par le script du skill dataviz (contraste ≥ 3:1, écart
 * daltonien ≥ 14 entre toutes les paires) en sombre (#8B5CF6, #EC4899,
 * #D97706 sur #0a0a0a) comme en clair (#7C3AED, #DB2777, #D97706 sur blanc) —
 * `--brand` et `--brand-accent` suivent déjà le thème.
 */
export const SPLIT_COLORS = {
  movies: "var(--brand)",
  series: "var(--brand-accent)",
  anime: "#D97706",
} as const;

type SplitKey = keyof typeof SPLIT_COLORS;

/**
 * La part de chaque nature dans le temps de la période : une barre empilée
 * à 100 %, segments séparés par 2 px de fond, et la légende qui porte les
 * valeurs — l'identité ne repose jamais sur la couleur seule.
 */
export const SplitBar = memo(function SplitBar({ split }: { split: ViewingStatsSplit }) {
  const f = useStatsFormat();
  const parts: Array<{ key: SplitKey; seconds: number }> = [
    { key: "movies" as const, seconds: split.movieSeconds },
    { key: "series" as const, seconds: split.seriesSeconds },
    { key: "anime" as const, seconds: split.animeSeconds },
  ].filter((p) => p.seconds > 0);
  const total = parts.reduce((n, p) => n + p.seconds, 0);
  if (total <= 0) return null;

  return (
    <div>
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-[4px]"
        style={{ gap: 2 }}
        role="img"
        aria-label={parts.map((p) => `${f.t(`split_${p.key}`)} ${f.percent(p.seconds / total)}`).join(", ")}
      >
        {parts.map((p) => (
          <span key={p.key} className="h-full" style={{ flexGrow: p.seconds, flexBasis: 0, background: SPLIT_COLORS[p.key] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SPLIT_COLORS[p.key] }} />
            <span className="text-content-secondary">{f.t(`split_${p.key}`)}</span>
            <span className="font-semibold tabular-nums text-content-primary">{f.percent(p.seconds / total)}</span>
            <span className="text-xs tabular-nums text-content-tertiary">{f.duration(p.seconds)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
