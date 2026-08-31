import { TentacleSvg } from "./ui/TentacleSvg";

interface CryingTentacleProps {
  size?: number;
}

/**
 * Le poulpe qui pleure — variante d'humeur du logo, pas un second dessin.
 *
 * Ce fichier portait une COPIE complète de la mascotte : toute retouche du logo
 * devait être refaite ici, et la copie avait déjà pris du retard d'une refonte.
 * Le balancement reste, lui : il appartient à cet usage-ci, pas au logo.
 */
export function CryingTentacle({ size = 120 }: CryingTentacleProps) {
  return (
    <TentacleSvg
      size={size}
      crying
      style={{ animation: "tentacle-sway 3s ease-in-out infinite" }}
    />
  );
}
