import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCardToggles } from "@tentacle-tv/api-client";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import type { MediaItem } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "../cards/cardGlyphs";
import { DetailDownloadAction } from "../../downloads/DetailDownloadAction";
import { GLASS_LENS_PROPS, useLiquidGlassMode, useLiquidGlassSurface } from "../../theme/glass";
import { useWtDetailAction } from "../../watchTogether/useWtDetailAction";
import { ON_MEDIA_ACCENT } from "./onMedia";

/**
 * Les bascules de la fiche — Favoris, Ma liste, Vu, Hors ligne, Watch
 * Together — réunies dans UNE capsule posée sur le décor.
 *
 * Cinq pastilles rondes, chacune avec son liseré et son flou, se lisaient
 * comme cinq boutons de même poids que « Lecture ». En capsule, elles forment
 * un seul objet secondaire, et l'œil va d'abord au bouton en couleur. Pas de
 * `backdrop-filter` : le voile de la scène est déjà sombre à cet endroit, un
 * flou n'y changerait rien de visible et coûterait une passe de composition.
 *
 * Mêmes glyphes que les cartes (signet, cœur, coche) : pleins quand l'état est
 * vrai — ce qu'on a reconnu sur l'affiche se retrouve ici, là où on le retire.
 */
export function DetailActionCapsule({ item }: { item: MediaItem }) {
  const { t } = useTranslation(["common", "cards"]);
  const wt = useWtDetailAction(item);
  // L'état IMMÉDIAT des trois bascules (`useCardToggles`) : le geste en cours passe devant
  // `item.UserData`, la capsule répond donc au clic, avant le serveur — et un épisode reflète
  // Ma liste et les favoris de sa série, comme sur une carte.
  const { watchlist: isInWatchlist, favorite: isFavorite, watched: isWatched, toggleList, toggleFavorite, toggleWatched } = useCardToggles(item);

  return (
    <DetailCapsule>
      <CapsuleButton
        active={isInWatchlist}
        onClick={toggleList}
        label={isInWatchlist ? t("common:removeFromMyList") : t("common:addToMyList")}
      >
        <BookmarkGlyph filled={isInWatchlist} className="h-5 w-5" />
      </CapsuleButton>
      <CapsuleButton
        active={isFavorite}
        tone="accent"
        onClick={toggleFavorite}
        label={isFavorite ? t("common:removeFromFavorites") : t("common:addToFavorites")}
      >
        <HeartGlyph filled={isFavorite} className="h-5 w-5" />
      </CapsuleButton>
      <CapsuleButton
        active={isWatched}
        onClick={toggleWatched}
        label={isWatched ? t("cards:markUnwatched") : t("cards:markWatched")}
      >
        <WatchedGlyph filled={isWatched} className="h-5 w-5" />
      </CapsuleButton>

      {/* Garder hors ligne (bureau) : rendu UNIQUEMENT avec le droit — le
          composant s'efface totalement sinon. */}
      <DetailDownloadAction item={item} variant="capsule" />

      {/* Watch Together : crée la salle avec ce média au programme et l'ouvre ;
          en salle, l'hôte invite d'ici. */}
      {wt && (
        <CapsuleButton active={wt.active} onClick={() => void wt.run()} label={wt.label}>
          <UsersThreeIcon size={20} weight={wt.active ? "fill" : "regular"} aria-hidden />
        </CapsuleButton>
      )}
    </DetailCapsule>
  );
}

/**
 * La capsule elle-même — un seul objet secondaire posé sur le décor. Partagée
 * avec la fiche d'un titre gardé, qui y range ses propres bascules.
 *
 * Verre natif (macOS 26) : le verre change le MATÉRIAU, jamais les DIMENSIONS
 * (Damien, 26/10) — même capsule, même pas entre les actions ; elle devient
 * UN verre de la maquette au ton sombre (`.lg-pane`), ses actions de simples
 * glyphes dedans (`lgDetailStage.css` : jamais de verre sur du verre).
 */
export function DetailCapsule({ children }: { children: ReactNode }) {
  const native = useLiquidGlassMode() === "native";
  return (
    <div
      role="group"
      data-lg-tone={native ? "dark" : undefined}
      className={native
        ? "lg-pane lgc-detail-capsule flex h-14 items-center gap-0.5 rounded-full border px-1.5"
        // Hors natif : un voile d'encre opaque à moitié, son arête en ombre intérieure — ni
        // liseré, ni flou (le décor dessous est immobile et déjà voilé).
        : "flex h-[52px] items-center gap-0.5 rounded-pill bg-[rgba(var(--scrim-media-rgb),0.5)] px-1.5 shadow-edge"}
    >
      {children}
    </div>
  );
}

export function CapsuleButton({ active, onClick, label, tone = "brand", children }: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "brand" | "accent";
  children: ReactNode;
}) {
  // Allumée : la teinte franche, la même pour les trois bascules (`tone` ne sert plus qu'au
  // verre natif, par `data-lg-toggle`).
  // Verre natif : une pastille ronde de verre clair ; allumée, le verre reste
  // clair et le GLYPHE prend l'accent (`data-lg-toggle`, lot lg7, R5 : Apple
  // colore le symbole d'une bascule, pas son verre) — jamais un anneau.
  const glass = useLiquidGlassSurface({
    material: "bead",
    // Posée sur une image (affiche, bannière, fiche) : le verre SOMBRE, quel que
    // soit le thème — la nacre du clair y perdait ses glyphes.
    tone: "dark",
    level: "clear",
    shape: "circle",
    interactive: true,
    className: "flex h-10 w-10 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]",
    fallbackClassName: `rounded-pill transition-[color,background-color,transform] duration-hover ease-out hover:bg-white/10 active:scale-[0.97] active:duration-press ${
      active ? ON_MEDIA_ACCENT : "text-on-media-secondary hover:text-on-media-primary"
    }`,
  });
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      data-lg-toggle={tone}
      {...GLASS_LENS_PROPS}
      {...glass.props}
    >
      {glass.layers}
      {children}
    </button>
  );
}
