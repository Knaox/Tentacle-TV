/**
 * Octave — le SEUL point de montage, dans Octave, de la bascule qui ramène aux
 * films et séries (`OctaveModeSwitch`, axe O2) : en pied de la barre latérale
 * (bureau, avec son libellé), dans l'en-tête (fenêtre étroite, l'interrupteur
 * seul).
 */

import { OctaveModeSwitch } from "../mode/OctaveModeSwitch";

interface OctaveModeSlotProps {
  onExit: () => void;
  /** En-tête étroit : l'interrupteur seul. */
  compact?: boolean;
}

export function OctaveModeSlot({ onExit, compact = false }: OctaveModeSlotProps) {
  if (compact) return <OctaveModeSwitch placement="octave" onExit={onExit} className="px-1" />;
  return (
    <OctaveModeSwitch
      placement="octave"
      onExit={onExit}
      showLabel
      className="w-full justify-between rounded-xl px-3 transition-colors duration-150 hover:bg-octave-hover"
    />
  );
}
