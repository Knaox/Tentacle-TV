import { TentacleLogo } from "./icons/TentacleLogo";

interface CryingTentacleProps {
  size?: number;
}

/**
 * Le poulpe qui pleure — variante d'humeur du logo, pas un second dessin.
 *
 * Ce fichier portait une COPIE complète de la mascotte : toute retouche du logo
 * devait être refaite ici, et la copie avait déjà pris du retard. Il ne reste
 * qu'un alias vers la variante `crying`.
 */
export function CryingTentacle({ size = 120 }: CryingTentacleProps) {
  return <TentacleLogo size={size} raw crying />;
}
