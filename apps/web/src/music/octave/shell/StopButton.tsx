/**
 * Octave — « Arrêter la lecture » (web et bureau) : la lecture s'arrête, la file d'attente et le contexte se
 * vident (`OctavePlayer.clear`) ; plus rien en cours, la vue « en cours » se referme d'elle-même et le
 * mini-lecteur disparaît. Un carré dans le dock et la vue « en cours », une croix dans le mini-lecteur du
 * téléphone (le congédier) — même geste, même libellé. Rien en cours : pas de bouton.
 */

import { memo } from "react";
import { Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";

interface StopButtonProps {
  shape: "stop" | "close";
  className: string;
}

export const StopButton = memo(function StopButton({ shape, className }: StopButtonProps) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const playing = usePlayerSelector((s) => s.current !== null);
  if (!playing) return null;
  return (
    <button
      type="button"
      onClick={() => player.clear()}
      aria-label={t("player.stop")}
      title={t("player.stop")}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}
    >
      {shape === "stop" ? <Square className="h-3.5 w-3.5" fill="currentColor" aria-hidden /> : <X className="h-5 w-5" aria-hidden />}
    </button>
  );
});
