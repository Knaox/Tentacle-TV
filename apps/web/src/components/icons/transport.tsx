import { forwardRef } from "react";
import type { Icon, IconProps } from "@phosphor-icons/react";
import { FastForwardIcon as FastForwardBase } from "@phosphor-icons/react/dist/csr/FastForward";
import { PauseIcon as PauseBase } from "@phosphor-icons/react/dist/csr/Pause";
import { PlayIcon as PlayBase } from "@phosphor-icons/react/dist/csr/Play";
import { RewindIcon as RewindBase } from "@phosphor-icons/react/dist/csr/Rewind";
import { SkipBackIcon as SkipBackBase } from "@phosphor-icons/react/dist/csr/SkipBack";
import { SkipForwardIcon as SkipForwardBase } from "@phosphor-icons/react/dist/csr/SkipForward";

/**
 * Les icônes de TRANSPORT (lire, pause, précédent, suivant, reculer, avancer) : toujours
 * PLEINES — règle de la refonte (docs/REFONTE-UI.md, « Icônes »). Partout ailleurs une icône
 * est au trait au repos et pleine quand son état est actif ; le transport, lui, ne change pas
 * de graisse : sa forme dit déjà tout, et un triangle au trait se lit mal sur une image.
 *
 * On importe le transport d'ICI, jamais du paquet : la graisse ne s'oublie pas. Un appelant
 * peut encore passer `weight` (une maquette, un état éteint) — il l'emporte.
 */
function filled(Base: Icon, name: string): Icon {
  const Filled = forwardRef<SVGSVGElement, IconProps>((props, ref) => <Base ref={ref} weight="fill" {...props} />);
  Filled.displayName = name;
  return Filled;
}

export const PlayIcon = filled(PlayBase, "PlayIcon");
export const PauseIcon = filled(PauseBase, "PauseIcon");
export const SkipBackIcon = filled(SkipBackBase, "SkipBackIcon");
export const SkipForwardIcon = filled(SkipForwardBase, "SkipForwardIcon");
export const RewindIcon = filled(RewindBase, "RewindIcon");
export const FastForwardIcon = filled(FastForwardBase, "FastForwardIcon");
