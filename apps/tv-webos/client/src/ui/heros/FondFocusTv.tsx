import { useLocation } from "react-router-dom";
import { HeroAmbilight } from "@/components/hero/HeroAmbilight";
import { useItemFocalise } from "../cartes/itemFocalise";

/**
 * L'affiche de la carte focalisée, en fond d'écran.
 *
 * **On reprend `HeroAmbilight`, on n'en écrit pas un second.** Il fait déjà
 * exactement cela pour la bannière, et il le fait bien : l'image est demandée à
 * 128 px de large, posée dans une boîte réduite au huitième, puis agrandie ×8
 * par le compositeur. Le flou est donc calculé sur un soixante-quatrième de la
 * surface — pour un rendu identique, puisque le rayon est divisé d'autant avant
 * d'être réagrandi. C'est la différence entre un effet qu'une dalle tient et un
 * effet qui la met à genoux.
 *
 * Le fondu est une animation CSS et non une transition de composant : le shim
 * de framer-motion ne diffère aucun démontage, `AnimatePresence` y est un
 * fragment. Changer d'item remonte donc un nouvel élément — et une animation
 * posée sur lui rejoue par construction, sans qu'on ait à tenir deux calques.
 *
 * Monté sur l'accueil et les bibliothèques seulement. Sur une fiche, la
 * bannière porte déjà son propre halo et les deux se disputeraient l'écran ;
 * pendant la lecture, rien ne doit être composé derrière l'image.
 */

const CHEMINS = ["/", "/library", "/watchlist", "/favorites"];

function surUnEcranDeParcours(chemin: string): boolean {
  if (chemin === "/") return true;
  for (const prefixe of CHEMINS) {
    if (prefixe !== "/" && chemin.startsWith(prefixe)) return true;
  }
  return false;
}

export function FondFocusTv() {
  const { pathname } = useLocation();
  const item = useItemFocalise();

  if (!item || !surUnEcranDeParcours(pathname)) return null;

  return (
    <div className="fond-focus" key={item.Id} aria-hidden>
      <HeroAmbilight item={item} opacity="var(--fond-focus-opacite)" className="absolute inset-0" />
    </div>
  );
}
