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
import { trackPhase } from "@tentacle-tv/offline-core/music";
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
  const phase = trackPhase(kept);
  if (phase === "none" || !kept) return null;
  if (phase === "complete") {
    return (
      <span className="inline-flex shrink-0 items-center text-status-success-fg" title={t("onDevice")}>
        <DownloadGlyph done className="h-3.5 w-3.5" />
        <span className="sr-only">{t("onDevice")}</span>
      </span>
    );
  }
  if (phase === "failed") {
    return (
      <span className="inline-flex shrink-0 items-center text-status-error-fg" title={t("failed")}>
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{t("failed")}</span>
      </span>
    );
  }
  const fraction = kept.expectedSize ? kept.bytesDone / kept.expectedSize : 0;
  return (
    <span className="inline-flex shrink-0 items-center text-octave-accent-text" title={t("inProgress")}>
      <ProgressRing fraction={fraction} size={14} />
      <span className="sr-only">{t("inProgress")}</span>
    </span>
  );
}
