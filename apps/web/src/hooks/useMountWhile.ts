import { useEffect, useState } from "react";

/**
 * « Monté tant que `actif`, plus le temps de son fondu de sortie. »
 *
 * Jumeau de [useHoverMount] pour les composants qui ne POSSÈDENT pas le survol :
 * celui-ci prend la condition en entrée au lieu de rendre des gestionnaires
 * d'évènements. C'est le cas d'une carte dont le parent détient l'état de survol
 * — il le partage avec un menu contextuel et un panneau d'aperçu, donc il ne peut
 * pas le déléguer.
 *
 * Sert la même règle : un contrôle en verre révélé au survol se MONTE à la
 * demande, il ne se masque pas. Un `backdrop-filter` (ou n'importe quel calque
 * composé) laissé à `opacity: 0` n'est pas gratuit — la couche subsiste, son
 * arrière-plan est recopié et son flou recalculé à chaque image si ce qui est
 * derrière bouge. Et il ne s'agit pas que de pixels : les contrôles d'une carte
 * portent des abonnements au cache, donc autant de re-rendus à chaque
 * invalidation.
 *
 * `exitMs` doit couvrir le plus lent des fondus de sortie, sinon il est coupé.
 */
export function useMountWhile(actif: boolean, exitMs: number): boolean {
  const [monte, setMonte] = useState(actif);

  useEffect(() => {
    if (actif) {
      setMonte(true);
      return;
    }
    const id = setTimeout(() => setMonte(false), exitMs);
    return () => clearTimeout(id);
  }, [actif, exitMs]);

  return monte;
}
