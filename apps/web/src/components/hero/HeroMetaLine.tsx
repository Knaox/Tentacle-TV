import type { MediaItem } from "@tentacle-tv/shared";
import type { MediaQuality } from "../../lib/mediaQuality";
import { LanguagePill, QualityChips, hasQualityChips } from "../media/MetaChips";
import { StarIcon } from "../icons/HeroIcons";

interface HeroMetaLineProps {
  item: MediaItem;
  quality: MediaQuality;
  runtime: string | null;
  /** Un épisode porte déjà sa qualité dans le sur-titre : on ne la répète pas. */
  showQuality: boolean;
}

/** Séparateur en pastille de marque — remplace les « · » en texte. */
function Dot() {
  return (
    <span
      aria-hidden
      className="h-1 w-1 flex-shrink-0 rounded-full"
      style={{ background: "rgba(var(--brand-rgb), 0.85)" }}
    />
  );
}

/**
 * Ligne d'informations sous le titre de la bannière. Posée sur l'affiche :
 * tout y est en tokens `on-media-*`, constants entre les deux schémas.
 */
export function HeroMetaLine({ item, quality, runtime, showQuality }: HeroMetaLineProps) {
  const genres = item.Genres?.slice(0, 3) ?? [];
  const withQuality = showQuality && (hasQualityChips(quality) || quality.audioLabels.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-on-media-secondary">
      {item.ProductionYear && <span className="font-semibold text-on-media-primary">{item.ProductionYear}</span>}

      {item.OfficialRating && (
        <span className="rounded border border-on-media-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
          {item.OfficialRating}
        </span>
      )}

      {item.CommunityRating != null && (
        <>
          <Dot />
          <span className="flex items-center gap-1 font-medium">
            {/* Étoile de marque — jamais dorée. */}
            <span aria-hidden className="text-[var(--brand-accent)]">
              <StarIcon />
            </span>
            {item.CommunityRating.toFixed(1)}
          </span>
        </>
      )}

      {runtime && (
        <>
          <Dot />
          <span>{runtime}</span>
        </>
      )}

      {genres.length > 0 && (
        <>
          <Dot />
          <span>{genres.join(" · ")}</span>
        </>
      )}

      {withQuality && (
        <span className="ml-1 flex items-center gap-1.5">
          <QualityChips quality={quality} density="full" />
          <LanguagePill labels={quality.audioLabels} max={4} />
        </span>
      )}
    </div>
  );
}
