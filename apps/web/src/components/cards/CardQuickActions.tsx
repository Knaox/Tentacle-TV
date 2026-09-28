import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "./cardGlyphs";
import { useCardToggles } from "@tentacle-tv/api-client";
import { stopCardClick } from "./cardEvents";

/**
 * • `compact` — colonne d'angle (la plus discrète).
 * • `bar`     — rangée horizontale (tiroir du panneau d'aperçu).
 * • `inline`  — rangée pleine taille de la bannière d'accueil.
 */
type QuickActionsVariant = "compact" | "bar" | "inline";

const VARIANT_STYLE: Record<QuickActionsVariant, { box: string; icon: string; dir: string }> = {
  compact: { box: "h-7 w-7", icon: "h-3.5 w-3.5", dir: "flex-col" },
  bar: { box: "h-8 w-8", icon: "h-4 w-4", dir: "flex-row" },
  inline: { box: "h-9 w-9", icon: "h-4 w-4", dir: "flex-row" },
};

interface CardQuickActionsProps {
  item: MediaItem;
  variant?: QuickActionsVariant;
}

/**
 * Ma liste / favori / vu en boutons ronds indépendants — la bannière et le
 * tiroir du panneau d'aperçu. Les cartes, elles, ont leur plateau
 * (`CardActionTray`). Même logique (`useCardToggles`), mêmes glyphes que les
 * marqueurs posés au repos : plein quand l'état est vrai.
 *
 * Noir translucide + blanc, constants dans les deux thèmes : ces boutons sont
 * posés sur une image (règle « posé sur média »).
 */
export function CardQuickActions({ item, variant = "compact" }: CardQuickActionsProps) {
  const { t } = useTranslation("cards");
  const toggles = useCardToggles(item);
  const { box, icon, dir } = VARIANT_STYLE[variant];
  const base = `${box} flex items-center justify-center rounded-full border bg-black/55 transition-transform duration-150 hover:scale-105`;

  const listLabel = toggles.watchlist ? t("removeFromWatchlist") : t("addToWatchlist");
  const favLabel = toggles.favorite ? t("removeFromFavorites") : t("addToFavorites");
  const watchedLabel = toggles.watched ? t("markUnwatched") : t("markWatched");

  return (
    <div className={`flex ${dir} gap-1.5`}>
      <button
        type="button"
        onClick={(e) => { stopCardClick(e); toggles.toggleList(); }}
        aria-label={listLabel}
        aria-pressed={toggles.watchlist}
        title={listLabel}
        className={`${base} ${toggles.watchlist ? "border-white text-white" : "border-white/40 text-white hover:border-white"}`}
      >
        <BookmarkGlyph className={icon} filled={toggles.watchlist} />
      </button>
      <button
        type="button"
        onClick={(e) => { stopCardClick(e); toggles.toggleFavorite(); }}
        aria-label={favLabel}
        aria-pressed={toggles.favorite}
        title={favLabel}
        className={`${base} ${
          toggles.favorite
            ? "border-[var(--brand-accent)] text-[var(--brand-accent)]"
            : "border-white/40 text-white hover:border-white"
        }`}
      >
        <HeartGlyph className={icon} filled={toggles.favorite} />
      </button>
      <button
        type="button"
        onClick={(e) => { stopCardClick(e); toggles.toggleWatched(); }}
        aria-label={watchedLabel}
        aria-pressed={toggles.watched}
        title={watchedLabel}
        className={`${base} ${toggles.watched ? "border-white text-white" : "border-white/40 text-white hover:border-white"}`}
      >
        <WatchedGlyph className={icon} filled={toggles.watched} />
      </button>
    </div>
  );
}
