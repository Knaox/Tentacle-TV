import type { MediaQuality } from "../../lib/mediaQuality";
import { MetaChip } from "./MetaChips";

interface Props {
  quality: MediaQuality;
  /** Conservé pour compat d'API ; le chip a désormais une taille unique. */
  compact?: boolean;
}

/**
 * Badges qualité de la page Detail — alignés sur le système de méta-tokens
 * unifié (cf. MetaChips). Monochrome, discret, le 4K étant le seul accent.
 * Ordre : résolution → VISION|HDR → ATMOS. Rien si aucune info exploitable.
 */
export function PremiumQualityBadges({ quality }: Props) {
  const { resolution, isHDR, isDolbyVision, isDolbyAtmos } = quality;
  if (!resolution && !isHDR && !isDolbyVision && !isDolbyAtmos) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {resolution === "4K" && <MetaChip tone="accent" ariaLabel="Ultra HD 4K">4K</MetaChip>}
      {resolution === "FHD" && <MetaChip>1080P</MetaChip>}
      {resolution === "HD" && <MetaChip>720P</MetaChip>}
      {resolution === "SD" && <MetaChip>SD</MetaChip>}
      {isDolbyVision ? (
        <MetaChip title="Dolby Vision">Vision</MetaChip>
      ) : (
        isHDR && <MetaChip>HDR</MetaChip>
      )}
      {isDolbyAtmos && <MetaChip title="Dolby Atmos">Atmos</MetaChip>}
    </div>
  );
}
