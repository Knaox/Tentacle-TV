/**
 * Octave — le SEUL point de montage, dans Octave, de ce qui ramène aux films
 * et séries : la bascule « Mode musique » (`OctaveModeSwitch`, le logo
 * d'Octave dans son pouce) et, juste dessous, « Films et séries », le retour
 * dit en toutes lettres — on sait toujours qu'on est dans le mode musique de
 * Tentacle, et comment en sortir. En TÊTE de la barre latérale, sous la
 * marque, dans un cartouche à eux (bureau) ; en haut à droite de l'en-tête
 * (fenêtre étroite, l'interrupteur seul). Le repère de la première visite
 * (`OctaveFirstVisitHint`) s'y accroche.
 */

import { useRef } from "react";
import { Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OctaveModeSwitch } from "../mode/OctaveModeSwitch";
import { OctaveFirstVisitHint } from "./OctaveFirstVisitHint";
import { useOctaveGlassStage } from "../glass/glassStage";

interface OctaveModeSlotProps {
  onExit: () => void;
  /** En-tête étroit : l'interrupteur seul. */
  compact?: boolean;
}

export function OctaveModeSlot({ onExit, compact = false }: OctaveModeSlotProps) {
  const { t } = useTranslation("octaveShell");
  const anchor = useRef<HTMLDivElement>(null);
  const stage = useOctaveGlassStage();
  if (compact) {
    return (
      <div ref={anchor}>
        <OctaveModeSwitch placement="octave" onExit={onExit} className="px-1" />
        <OctaveFirstVisitHint anchor={anchor} compact />
      </div>
    );
  }
  return (
    <div ref={anchor} className={`${stage ? "lg-bead " : ""}flex flex-col gap-0.5 rounded-xl bg-octave-hover p-1`} data-octave-mode-slot>
      <OctaveModeSwitch
        placement="octave"
        onExit={onExit}
        showLabel
        className="w-full justify-between rounded-lg px-2 py-0.5 transition-colors duration-150 hover:bg-octave-selected"
      />
      <button
        type="button"
        onClick={onExit}
        title={t("backToFilms.hint")}
        className="flex min-h-[36px] w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-octave-selected hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        data-octave-back-to-films
      >
        <Clapperboard aria-hidden className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        <span className="truncate">{t("backToFilms.label")}</span>
      </button>
      <OctaveFirstVisitHint anchor={anchor} />
    </div>
  );
}
