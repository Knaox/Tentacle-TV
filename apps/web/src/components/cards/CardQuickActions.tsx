import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "./cardGlyphs";
import { useCardToggles } from "@tentacle-tv/api-client";
import { stopCardClick } from "./cardEvents";
import { GLASS_LENS_PROPS, useLiquidGlassSurface } from "../../theme/glass";
import { ON_MEDIA_ACCENT_TEXT } from "./onMedia";

/**
 * • `compact` — colonne d'angle (la plus discrète).
 * • `bar`     — rangée horizontale.
 * • `inline`  — rangée pleine taille de la bannière d'accueil.
 */
type QuickActionsVariant = "compact" | "bar" | "inline";

const VARIANT_STYLE: Record<QuickActionsVariant, { box: string; icon: string; dir: string }> = {
  compact: { box: "h-7 w-7", icon: "h-3.5 w-3.5", dir: "flex-col" },
  bar: { box: "h-8 w-8", icon: "h-4 w-4", dir: "flex-row" },
  inline: { box: "h-11 w-11", icon: "h-5 w-5", dir: "flex-row" },
};

interface CardQuickActionsProps {
  item: MediaItem;
  variant?: QuickActionsVariant;
}

/**
 * Ma liste / favori / vu en boutons ronds indépendants — la bannière
 * d'accueil. Les cartes, elles, ont leur plateau (`CardActionTray`). Même logique (`useCardToggles`), mêmes glyphes que les
 * marqueurs posés au repos : plein quand l'état est vrai.
 *
 * Noir translucide + blanc, constants dans les deux thèmes : ces boutons sont
 * posés sur une image (règle « posé sur média »).
 */
export function CardQuickActions({ item, variant = "compact" }: CardQuickActionsProps) {
  const { t } = useTranslation("cards");
  const toggles = useCardToggles(item);
  const { box, icon, dir } = VARIANT_STYLE[variant];
  // Le verre (mode natif) sur la bannière seulement : une instance à l'écran.
  const glass = variant === "inline";
  // Au repos, l'ivoire ; allumée, la teinte franche (et le glyphe plein) — les trois bascules,
  // plus seulement le cœur : un état actif se dit de la même façon partout.
  const off = "text-on-media-primary";
  const on = ON_MEDIA_ACCENT_TEXT;

  const listLabel = toggles.watchlist ? t("removeFromWatchlist") : t("addToWatchlist");
  const favLabel = toggles.favorite ? t("removeFromFavorites") : t("addToFavorites");
  const watchedLabel = toggles.watched ? t("markUnwatched") : t("markWatched");

  return (
    <div className={`flex ${dir} gap-1.5`}>
      <QuickButton glass={glass} box={box} active={toggles.watchlist} label={listLabel}
        state={toggles.watchlist ? on : off}
        onClick={() => toggles.toggleList()}>
        <BookmarkGlyph className={icon} filled={toggles.watchlist} />
      </QuickButton>
      <QuickButton glass={glass} box={box} active={toggles.favorite} accent label={favLabel}
        state={toggles.favorite ? on : off}
        onClick={() => toggles.toggleFavorite()}>
        <HeartGlyph className={icon} filled={toggles.favorite} />
      </QuickButton>
      <QuickButton glass={glass} box={box} active={toggles.watched} label={watchedLabel}
        state={toggles.watched ? on : off}
        onClick={() => toggles.toggleWatched()}>
        <WatchedGlyph className={icon} filled={toggles.watched} />
      </QuickButton>
    </div>
  );
}

/**
 * Un rond d'action. Verre natif (bannière) : une pastille ronde de verre
 * clair, glyphes adaptés au décor ; allumée, le verre reste clair et c'est le
 * GLYPHE qui le dit — plein, à l'accent (`data-lg-toggle` : signet et coche
 * violets, cœur rose ; lot lg7, R5). Le seul fond coloré reste « Lecture ». Ailleurs :
 * le rond cerclé d'avant.
 */
function QuickButton({ glass, box, active, accent = false, label, state, onClick, children }: {
  glass: boolean;
  box: string;
  active: boolean;
  accent?: boolean;
  label: string;
  /** Bord et couleur du rendu d'avant, selon l'état. */
  state: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const layout = `${box} flex items-center justify-center`;
  // Un rond de voile, sans liseré ni flou : la pression répond (97 %), le survol éclaircit le voile.
  const veil = glass ? "bg-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.24)]" : "bg-[rgba(11,11,12,0.72)] hover:bg-[rgba(11,11,12,0.86)]";
  const skin = `rounded-full transition-[transform,background-color] duration-press ease-out active:scale-[0.97] ${veil} ${state}`;
  const surface = useLiquidGlassSurface({
    material: "bead",
    // Posée sur une image (affiche, bannière, fiche) : le verre SOMBRE, quel que
    // soit le thème — la nacre du clair y perdait ses glyphes.
    tone: "dark",
    level: "clear",
    shape: "circle",
    interactive: true,
    className: layout,
    fallbackClassName: skin,
  });
  return (
    <button
      type="button"
      onClick={(e) => { stopCardClick(e); onClick(); }}
      aria-label={label}
      aria-pressed={active}
      data-lg-toggle={accent ? "accent" : "brand"}
      title={label}
      {...(glass ? { ...GLASS_LENS_PROPS, ...surface.props } : { className: `${layout} ${skin}` })}
    >
      {glass && surface.layers}
      {children}
    </button>
  );
}
