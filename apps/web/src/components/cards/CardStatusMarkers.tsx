import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cardDeviceLabelKey, type CardDeviceState, type CardStatusKind } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, KeptGlyph, WatchedGlyph } from "./cardGlyphs";

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
 * Trois formes distinctes, pas trois couleurs : le cœur prend l'accent de
 * marque, mais aucun état ne repose sur la couleur seule. Un seul libellé
 * accessible pour la capsule entière (« Dans ma liste, Déjà vu »).
 *
 * Aucun `backdrop-filter` : la capsule vit au repos, sur chaque carte. Fond
 * noir à 70 % et liseré blanc, constants dans les deux thèmes — posée sur
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
      className={`pointer-events-none absolute ${className ?? "right-2 top-2"} z-20 flex h-6 items-center gap-1 rounded-full border border-white/15 bg-black/70 px-1.5 text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-opacity duration-150 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      {statuses.map((kind) =>
        kind === "watchlist" ? (
          <BookmarkGlyph key={kind} className={GLYPH} filled />
        ) : kind === "favorite" ? (
          <span key={kind} className="text-[var(--brand-accent)]">
            <HeartGlyph className={GLYPH} filled />
          </span>
        ) : (
          <WatchedGlyph key={kind} className={GLYPH} filled />
        ),
      )}
      {/* Après les états : l'ordre même du plateau, où l'extra « hors ligne »
          suit les bascules. Le vert de « prêt », pas une seconde coche — un
          vert CONSTANT (#34D399) : posé sur média, comme le reste de la
          pastille ; le jeton de succès du thème clair est un vert sombre. */}
      {device !== null && (
        <span className="text-emerald-400">
          <KeptGlyph className={GLYPH} />
        </span>
      )}
    </div>
  );
});
