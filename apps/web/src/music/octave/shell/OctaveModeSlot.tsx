/**
 * Octave — le SEUL point de montage, dans Octave, du geste qui ramène aux
 * films et séries : en pied de la barre latérale (bureau), dans l'en-tête
 * (fenêtre étroite). La bascule du lot (axe O2) remplace ce contenu ; la
 * coquille n'a rien d'autre à changer.
 */

import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OctaveModeSlotProps {
  onExit: () => void;
  /** En-tête étroit : l'icône seule. */
  compact?: boolean;
}

export function OctaveModeSlot({ onExit, compact = false }: OctaveModeSlotProps) {
  const { t } = useTranslation("music");
  if (compact) {
    return (
      <button
        type="button"
        onClick={onExit}
        aria-label={t("mode.exit")}
        title={t("mode.exitHint")}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <LogOut className="h-5 w-5" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onExit}
      title={t("mode.exitHint")}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-content-tertiary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <LogOut className="h-5 w-5" aria-hidden />
      {t("mode.exit")}
    </button>
  );
}
