import { TentacleLogo } from "./TentacleLogo";

interface CryingTentacleProps {
  size?: number;
}

/**
 * Le poulpe qui pleure — variante d'humeur du logo, pas un second dessin.
 * Ce fichier portait une copie complète de la mascotte, déjà en retard d'une
 * refonte.
 */
export function CryingTentacle({ size = 120 }: CryingTentacleProps) {
  return <TentacleLogo size={size} crying />;
}
