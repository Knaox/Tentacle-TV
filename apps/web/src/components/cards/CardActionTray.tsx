import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardDownloadAction } from "../../downloads/CardDownloadAction";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "./cardGlyphs";
import { stopCardClick, useCardToggles } from "./useCardToggles";

interface CardActionTrayProps {
  item: MediaItem;
  /** `sm` pour les affiches étroites (≤ 140 px), `md` ailleurs. */
  size?: "sm" | "md";
  /** Occupe toute la largeur (affiche) ou épouse son contenu (vignette 16:9). */
  stretch?: boolean;
}

const SIZE = {
  sm: { box: "h-7 w-7", icon: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8", icon: "h-4 w-4" },
} as const;

/**
 * Le plateau d'actions révélé au survol d'une carte : Ma liste, favori, vu —
 * et le bouton hors ligne quand le bureau le permet — dans UNE capsule.
 *
 * Il remplace la colonne de trois pastilles rondes empilées dans l'angle, qui
 * cachait l'affiche et se lisait comme trois boutons sans rapport. La capsule
 * reprend, dans le même ordre et avec les mêmes glyphes, la pastille d'états
 * du repos : l'état qu'on voyait se retrouve exactement là où on le bascule.
 *
 * Posée sur le voile sombre du survol (≥ 0,9 d'alpha en bas) : pas de
 * `backdrop-filter`, il n'y aurait rien de visible à flouter. Un blanc à 12 %
 * et un liseré suffisent à dessiner le verre.
 */
export function CardActionTray({ item, size = "md", stretch = false }: CardActionTrayProps) {
  const { t } = useTranslation("cards");
  const toggles = useCardToggles(item);
  const { box, icon } = SIZE[size];

  return (
    <div
      role="toolbar"
      aria-label={item.Name}
      onClick={stopCardClick}
      className={`flex items-center gap-0.5 rounded-full border border-white/15 bg-white/[0.12] p-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)] ${
        stretch ? "w-full justify-between" : ""
      }`}
    >
      <TrayButton
        box={box}
        active={toggles.inList}
        label={toggles.inList ? t("removeFromWatchlist") : t("addToWatchlist")}
        onPress={toggles.toggleList}
      >
        <BookmarkGlyph className={icon} filled={toggles.inList} />
      </TrayButton>
      <TrayButton
        box={box}
        active={toggles.favorite}
        accent
        label={toggles.favorite ? t("removeFromFavorites") : t("addToFavorites")}
        onPress={toggles.toggleFavorite}
      >
        <HeartGlyph className={icon} filled={toggles.favorite} />
      </TrayButton>
      <TrayButton
        box={box}
        active={toggles.watched}
        label={toggles.watched ? t("markUnwatched") : t("markWatched")}
        onPress={toggles.toggleWatched}
      >
        <WatchedGlyph className={icon} filled={toggles.watched} />
      </TrayButton>
      {/* Bureau ET droit, sinon PAS rendu (ni grisé, ni cadenas). Même gabarit
          rond : il s'aligne dans la capsule comme un quatrième bouton. */}
      <CardDownloadAction item={item} variant={size === "sm" ? "compact" : "bar"} tone="tray" />
    </div>
  );
}

interface TrayButtonProps {
  box: string;
  active: boolean;
  /** L'état actif prend l'accent de marque (le cœur) plutôt que le blanc. */
  accent?: boolean;
  label: string;
  onPress: () => void;
  children: ReactNode;
}

function TrayButton({ box, active, accent = false, label, onPress, children }: TrayButtonProps) {
  const tone = active
    ? accent
      ? "bg-white/15 text-[var(--brand-accent)]"
      : "bg-white/15 text-white"
    : "text-white/80 hover:bg-white/10 hover:text-white";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={(e) => {
        stopCardClick(e);
        onPress();
      }}
      className={`${box} flex shrink-0 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${tone}`}
    >
      {children}
    </button>
  );
}
