import { memo } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { metaTokens } from "./detailMetrics";

const CHIP = "rounded-[5px] px-[7px] py-0.5 text-[10.5px] font-semibold uppercase leading-[14px] tracking-[0.5px]";

/**
 * `MetaTokens` de l'app : qualité et langues en jetons discrets (10,5
 * semi-gras capitales, rayon 5, filet `border.strong`) ; seul le 4K porte
 * l'accent de marque. Marge 10 au-dessus, 4 en compact (lignes d'épisodes).
 */
export const MetaTokens = memo(function MetaTokens({ item, compact = false, onMedia = false }: {
  item?: MediaItem;
  compact?: boolean;
  /** Posés sur la scène : jetons `on-media` (le décor est dessous dans les deux thèmes). */
  onMedia?: boolean;
}) {
  const { tokens, langs } = metaTokens(item);
  if (tokens.length === 0 && langs.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center ${compact ? "mt-1 gap-[5px]" : "mt-2.5 gap-1.5"}`}>
      {tokens.map((tk) => (
        <span
          key={tk.label}
          className={`${CHIP} ${
            tk.accent
              ? onMedia ? "text-white" : "mirror-token-accent bg-[var(--brand-soft)]"
              : onMedia ? "text-on-media-secondary" : "bg-fill-subtle text-content-secondary"
          }`}
          style={{
            border: "0.5px solid",
            borderColor: tk.accent ? "rgba(var(--brand-rgb), 0.5)" : onMedia ? "var(--on-media-muted)" : "var(--border-strong)",
            // Sur la scène, le 4K a son assise sombre teintée de marque et son
            // blanc CONSTANT, comme la puce du web (même dans la colonne claire
            // de l'iPad, où les jetons `on-media` suivent la page) : le violet
            // léger sur un voile violet à 15 % tombait à 3:1 sur un décor clair.
            background: onMedia
              ? tk.accent ? "linear-gradient(180deg, rgba(42,28,70,0.78), rgba(22,14,40,0.86))" : "rgba(var(--scrim-media-rgb), 0.4)"
              : undefined,
          }}
        >
          {tk.label}
        </span>
      ))}
      {langs.length > 0 && (
        <span
          className={`${CHIP} ${onMedia ? "text-on-media-secondary" : "bg-fill-subtle text-content-secondary"}`}
          style={onMedia
            ? { border: "0.5px solid var(--on-media-muted)", background: "rgba(var(--scrim-media-rgb), 0.4)" }
            : { border: "0.5px solid var(--border-strong)" }}
        >
          {langs.join(" · ")}
        </span>
      )}
    </div>
  );
});
