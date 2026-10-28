/**
 * Octave — la marque d'un titre gardé sur cet appareil, dans sa rangée : le
 * glyphe hors ligne de Tentacle (celui des cartes de films), au ton de réussite
 * une fois gardé ; un anneau qui se remplit pendant la préparation ; le défaut
 * en mot. Toujours un mot pour les lecteurs d'écran, jamais la couleur seule.
 * Rien hors de la portée (le web) ni pour un titre qui n'est pas gardé.
 */

import { memo } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { trackFraction, trackStage } from "./keptProgress";
import { useOfflineSurface } from "./offlineSurfaceContext";
import { useKeptTrack } from "./useKeptMusic";
import { ProgressRing } from "./ProgressRing";

export const KeptMark = memo(function KeptMark({ trackKey }: { trackKey: string }) {
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return <KeptMarkFor trackKey={trackKey} />;
});

function KeptMarkFor({ trackKey }: { trackKey: string }) {
  const { t } = useTranslation("musicOffline");
  const kept = useKeptTrack(trackKey);
  const stage = trackStage(kept);
  if (stage === "none" || !kept) return null;
  if (stage === "complete") {
    return (
      <span className="inline-flex shrink-0 items-center text-status-success-fg" title={t("onDevice")}>
        <DownloadGlyph done className="h-3.5 w-3.5" />
        <span className="sr-only">{t("onDevice")}</span>
      </span>
    );
  }
  if (stage === "failed") {
    return (
      <span className="inline-flex shrink-0 items-center text-status-error-fg" title={t("failed")}>
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{t("failed")}</span>
      </span>
    );
  }
  // Trois attentes distinctes, jamais la couleur seule : la forme de l'anneau et un mot.
  const fraction = trackFraction(kept);
  const label =
    stage === "preparing" ? t("preparing") : stage === "waiting" ? t("waiting") : t("transferring", { percent: Math.round(fraction * 100) });
  return (
    <span className="inline-flex shrink-0 items-center text-octave-accent-text" title={label}>
      <ProgressRing fraction={fraction} size={14} mode={stage === "transferring" ? "progress" : stage} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
