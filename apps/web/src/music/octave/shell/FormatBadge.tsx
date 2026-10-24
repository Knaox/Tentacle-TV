/**
 * Octave — la qualité RÉELLE de ce qui joue (format décodé par le moteur s'il
 * l'a dit, sinon celui du fichier) : « FLAC · 24 bits · 96 kHz », et la
 * mention « Sans perte » / « Haute résolution » quand elle est vraie.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { MusicAudioFormat } from "@tentacle-tv/shared/music";
import { formatParts } from "@tentacle-tv/shared/octave";

export const FormatBadge = memo(function FormatBadge({ format, compact = false }: { format: MusicAudioFormat | null; compact?: boolean }) {
  const { t, i18n } = useTranslation("music");
  if (!format) return null;
  const parts = formatParts(format, i18n.language, {
    bits: (n) => t("player.bits", { count: n }),
    kbps: (n) => t("player.kbps", { count: n }),
  });
  const quality = parts.hiRes ? t("player.hiRes") : parts.lossless ? t("player.lossless") : null;
  const full = [parts.codec, parts.detail, quality].filter(Boolean).join(" · ");
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-line-subtle px-2 py-0.5 text-[11px] font-medium tabular-nums text-content-secondary" title={full}>
      {quality && <span className="octave-brand-text font-semibold">{quality}</span>}
      <span className="truncate">{compact ? parts.codec : [parts.codec, parts.detail].filter(Boolean).join(" · ")}</span>
    </span>
  );
});
