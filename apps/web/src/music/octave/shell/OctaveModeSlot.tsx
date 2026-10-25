/**
 * Octave — le SEUL point de montage, dans Octave, de la bascule qui ramène aux
 * films et séries (`OctaveModeSwitch`, axe O2, le glyphe d'Octave dans son
 * pouce) : en TÊTE de la barre latérale, sous la marque, dans un cartouche à
 * elle (bureau, avec son libellé) — c'est l'interrupteur qu'on voit en
 * premier ; en haut à droite de l'en-tête (fenêtre étroite, l'interrupteur seul).
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
      className="w-full justify-between rounded-xl bg-octave-hover px-3 py-1 transition-colors duration-150 hover:bg-octave-selected"
    />
  );
}
