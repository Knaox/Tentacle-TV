/**
 * Octave — la qualité RÉELLE de ce qui joue (format décodé par le moteur s'il
 * l'a dit, sinon celui du fichier) : « FLAC · 24 bits · 96 kHz », et la
 * mention « Sans perte » / « Haute résolution » quand elle est vraie.
 * Compacte (le dock à l'étroit), UN mot : la mention si elle est vraie, sinon
 * le codec ; le détail reste dans l'infobulle. En ICÔNE (le dock plus étroit
 * encore) : un pictogramme seul, rose si la qualité est sans perte, dont le
 * nom accessible et l'infobulle disent tout — jamais un mot coupé.
 */

import { memo } from "react";
import { AudioLines } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicAudioFormat } from "@tentacle-tv/shared/music";
import { formatParts } from "@tentacle-tv/shared/octave";

interface FormatBadgeProps {
  format: MusicAudioFormat | null;
  compact?: boolean;
  icon?: boolean;
}

export const FormatBadge = memo(function FormatBadge({ format, compact = false, icon = false }: FormatBadgeProps) {
  const { t, i18n } = useTranslation("music");
  if (!format) return null;
  const parts = formatParts(format, i18n.language, {
    bits: (n) => t("player.bits", { count: n }),
    kbps: (n) => t("player.kbps", { count: n }),
  });
  const quality = parts.hiRes ? t("player.hiRes") : parts.lossless ? t("player.lossless") : null;
  const full = [quality, parts.codec, parts.detail].filter(Boolean).join(" · ");
  if (icon) {
    const label = t("shell.quality", { detail: full });
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-line-subtle ${quality ? "text-octave-accent-text" : "text-content-tertiary"}`}
      >
        <AudioLines className="h-3 w-3" aria-hidden />
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-line-subtle px-2 py-0.5 text-[11px] font-medium tabular-nums text-content-secondary" title={full}>
      {quality && <span className="octave-brand-text font-semibold">{quality}</span>}
      {!(compact && quality) && <span className="truncate">{compact ? parts.codec : [parts.codec, parts.detail].filter(Boolean).join(" · ")}</span>}
    </span>
  );
});
