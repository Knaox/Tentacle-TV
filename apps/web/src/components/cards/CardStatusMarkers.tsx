import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cardDeviceLabelKey, type CardDeviceState, type CardStatusKind } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, KeptGlyph, WatchedGlyph } from "./cardGlyphs";
import { ON_MEDIA_ACCENT_TEXT, ON_MEDIA_PILL } from "./onMedia";

interface CardStatusMarkersProps {
  /** États vrais, déjà ordonnés (`resolveCardMarkers`). Vide : rien n'est rendu. */
  statuses: readonly CardStatusKind[];
  /** « Sur cette machine » (bureau), au bout de la pastille — `null` : rien de gardé. */
  device?: CardDeviceState | null;
  /** Faux = fondu de sortie (le plateau du survol reprend ces états). */
  shown?: boolean;
  /** Autre ancrage que le coin haut-droit. */
  className?: string;
}

const GLYPH = "h-3 w-3";

/**
 * La pastille d'états d'une carte, façon Crunchyroll : signet (Ma liste),
 * cœur (favori), coche (vu) — puis, sur le bureau, « sur cette machine » —
 * réunis dans UNE capsule d'angle au lieu de badges épars. L'œil trouve un seul endroit où regarder, et une carte sans
 * état reste parfaitement propre — aucune capsule vide.
 *
 * Trois formes distinctes, pas trois couleurs : le cœur et la coche prennent
 * la teinte franche, mais aucun état ne repose sur la couleur seule. Un seul libellé
 * accessible pour la capsule entière (« Dans ma liste, Déjà vu »).
 *
 * Aucun `backdrop-filter` : la capsule vit au repos, sur chaque carte. Un
 * voile d'encre sans liseré, constant dans les deux thèmes — posée sur
 * média. Seule l'opacité transitionne.
 */
export const CardStatusMarkers = memo(function CardStatusMarkers({
  statuses,
  device = null,
  shown = true,
  className,
}: CardStatusMarkersProps) {
  const { t } = useTranslation("cards");
  if (statuses.length === 0 && device === null) return null;
  const parts = statuses.map((kind) => t(`status.${kind}`));
  if (device !== null) parts.push(t(cardDeviceLabelKey(device)));
  const label = parts.join(", ");

  return (
    <div
      role="img"
      aria-label={label}
      // Pas de `title` : la capsule ne reçoit pas le pointeur (elle ne doit pas
      // voler le clic de la carte), une infobulle n'y paraîtrait jamais.
      // Repère stable pour la feuille de la LG (agrandie à trois mètres).
      data-card-status=""
      className={`pointer-events-none absolute ${className ?? "right-[7px] top-[7px]"} z-20 flex h-6 items-center gap-1 rounded-full px-1.5 text-on-media-primary transition-opacity duration-hover ${ON_MEDIA_PILL} ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      {statuses.map((kind) =>
        kind === "watchlist" ? (
          <BookmarkGlyph key={kind} className={GLYPH} filled />
        ) : kind === "favorite" ? (
          <span key={kind} className={ON_MEDIA_ACCENT_TEXT}>
            <HeartGlyph className={GLYPH} filled />
          </span>
        ) : (
          <span key={kind} className={ON_MEDIA_ACCENT_TEXT}>
            <WatchedGlyph className={GLYPH} filled />
          </span>
        ),
      )}
      {/* Après les états : l'ordre même du plateau, où l'extra « hors ligne »
          suit les bascules. La flèche vers son plateau, ivoire comme le signet
          (le prototype validé) : sa FORME dit « sur cette machine », plus un vert. */}
      {device !== null && <KeptGlyph className={GLYPH} />}
    </div>
  );
});
