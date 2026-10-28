import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  useFavoriteForItem,
  useToggleWatchlistForItem,
  useWatchedToggle,
  useWatchlistSeriesIds,
  useFavoriteSeriesIds,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "../cards/cardGlyphs";
import { DetailDownloadAction } from "../../downloads/DetailDownloadAction";
import { GLASS_LENS_PROPS, useLiquidGlassMode, useLiquidGlassSurface } from "../../theme/glass";
import { useWtDetailAction } from "../../watchTogether/useWtDetailAction";

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
  const isEpisode = item.Type === "Episode";
  const { add: addFav, remove: removeFav } = useFavoriteForItem(item);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlistForItem(item);
  const { markWatched, markUnwatched } = useWatchedToggle(item.Id, {
    seriesId: item.SeriesId,
    seasonId: item.SeasonId,
    itemType: item.Type,
  });
  const watchlistSeries = useWatchlistSeriesIds();
  const favoriteSeries = useFavoriteSeriesIds();

  // Un épisode reflète l'état de sa série ; film et série lisent UserData.
  const isFavorite = isEpisode ? favoriteSeries.has(item.SeriesId) : item.UserData?.IsFavorite === true;
  const isInWatchlist = isEpisode ? watchlistSeries.has(item.SeriesId) : item.UserData?.Likes === true;
  const isWatched = item.UserData?.Played === true;

  return (
    <DetailCapsule>
      <CapsuleButton
        active={isInWatchlist}
        onClick={() => (isInWatchlist ? removeWatchlist.mutate() : addWatchlist.mutate())}
        label={isInWatchlist ? t("common:removeFromMyList") : t("common:addToMyList")}
      >
        <BookmarkGlyph filled={isInWatchlist} className="h-5 w-5" />
      </CapsuleButton>
      <CapsuleButton
        active={isFavorite}
        tone="accent"
        onClick={() => (isFavorite ? removeFav.mutate() : addFav.mutate())}
        label={isFavorite ? t("common:removeFromFavorites") : t("common:addToFavorites")}
      >
        <HeartGlyph filled={isFavorite} className="h-5 w-5" />
      </CapsuleButton>
      <CapsuleButton
        active={isWatched}
        onClick={() => (isWatched ? markUnwatched.mutate() : markWatched.mutate())}
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
          <UsersIcon />
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
        : "flex h-14 items-center gap-0.5 rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.38)] px-1.5"}
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
  const activeColor = tone === "accent" ? "text-[var(--brand-accent)]" : "text-[var(--brand-light)]";
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
    className: "flex h-11 w-11 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]",
    fallbackClassName: `rounded-full transition-[color,background-color,transform] duration-150 hover:bg-white/10 active:scale-95 ${
      active ? activeColor : "text-on-media-secondary hover:text-on-media-primary"
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

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}
