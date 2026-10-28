/**
 * Octave (mobile) — la GARDE d'une entrée du registre : `children` seulement
 * si son droit est là (`octaveRequirementState`), `unmet` une fois l'absence
 * établie, rien tant qu'on ne sait pas. Les capacités viennent de la seule
 * porte des clients (`useServerCapabilities`) ; le droit, du crochet que
 * l'entrée déclare (mêmes sources que le bureau).
 */

import type { ReactNode } from "react";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import type { OctaveRequirement } from "./octaveRegistryTypes";
import { octaveRequirementState } from "./octaveRequirement";

interface Props {
  requires?: OctaveRequirement;
  children: ReactNode;
  /** Rendu quand le droit manque (une redirection, rien par défaut). */
  unmet?: ReactNode;
  /** Rendu tant que le droit n'est pas connu (rien par défaut). */
  pending?: ReactNode;
}

function Evaluate({ requires, allowed, children, unmet = null, pending = null }: Props & { allowed: boolean | null | undefined }) {
  const { capabilities, settled, known } = useServerCapabilities();
  const state = octaveRequirementState(requires, { capabilities, capsSettled: settled, capsKnown: known, allowed });
  if (state === "met") return <>{children}</>;
  return <>{state === "unmet" ? unmet : pending}</>;
}

function WithAllowed({ useAllowed, ...props }: Props & { useAllowed: () => boolean | null }) {
  const allowed = useAllowed();
  return <Evaluate {...props} allowed={allowed} />;
}

export function OctaveRequires(props: Props) {
  const useAllowed = props.requires?.useAllowed;
  return useAllowed ? <WithAllowed {...props} useAllowed={useAllowed} /> : <Evaluate {...props} allowed={undefined} />;
}
