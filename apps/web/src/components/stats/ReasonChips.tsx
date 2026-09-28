import { memo } from "react";
import { Heart, Repeat, Star, ThumbsDown, ThumbsUp, Sparkles, type LucideIcon } from "lucide-react";
import type { StatsTitleReason } from "@tentacle-tv/shared";
import type { StatsFormat } from "./useStatsFormat";

export interface ReasonChip {
  key: string;
  label: string;
  /** Ce que lit un lecteur d'écran quand le libellé ne suffit pas (« Votre note : 8 sur 10 »). */
  ariaLabel?: string;
  Icon?: LucideIcon;
}

const ICONS: Record<StatsTitleReason["kind"], LucideIcon> = {
  rating: Star,
  superlike: Sparkles,
  like: ThumbsUp,
  dislike: ThumbsDown,
  favorite: Heart,
  viewings: Repeat,
};

/** L'étoile de la note et le cœur du favori sont pleins, comme sur les cartes. */
const FILLED = new Set(["rating", "favorite"]);

/** Les avis d'un titre en étiquettes, la note avec son étoile (« ★ 8 ») comme sur les cartes. */
export function reasonChips(f: StatsFormat, reasons: readonly StatsTitleReason[], { withViewings = false } = {}): ReasonChip[] {
  const out: ReasonChip[] = [];
  for (const r of reasons) {
    if (r.kind === "viewings") {
      if (withViewings) out.push({ key: r.kind, label: f.t("viewings", { count: r.value }), Icon: ICONS.viewings });
      continue;
    }
    if (r.kind === "rating") {
      const value = f.number(r.value, r.value % 1 ? 1 : 0);
      out.push({ key: r.kind, label: value, ariaLabel: f.t("chipRating", { rating: value }), Icon: ICONS.rating });
      continue;
    }
    out.push({ key: r.kind, label: f.t(`reason_${r.kind}`), Icon: ICONS[r.kind] });
  }
  return out;
}

/**
 * Les étiquettes : neutres (liseré fin, encre secondaire), l'icône seule à la
 * couleur de la marque — l'identité ne tient jamais à la couleur seule.
 */
export const ReasonChips = memo(function ReasonChips({ chips, className }: { chips: ReasonChip[]; className?: string }) {
  return (
    <span className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {chips.map(({ key, label, Icon }) => (
        <span
          key={key}
          className="inline-flex h-5 items-center gap-1 rounded-full bg-fill-soft px-2 text-[11px] font-semibold tabular-nums text-content-secondary"
        >
          {Icon && <Icon size={11} aria-hidden className="text-[var(--brand-light)]" fill={FILLED.has(key) ? "currentColor" : "none"} />}
          {label}
        </span>
      ))}
    </span>
  );
});
