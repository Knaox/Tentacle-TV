import { RecoHero } from "../RecoHero";
import { RecoBillboard } from "./RecoBillboard";
import { useRecoHeroSlides } from "./recoHeroSlides";

/**
 * LE point de vérité du héros de recommandations, partagé entre la page
 * Recommandations et l'accueil (mode héros « reco ») : le carrousel quand des
 * diapositives à visuel large existent, sinon l'ancienne carte héros en repli
 * (phase préliminaire sans backdrops, vieux pools) — et rien du tout tant
 * qu'aucun item n'est servi.
 */
export function RecoBillboardSlot() {
  const { slides, fallbackItem } = useRecoHeroSlides();
  if (slides.length === 0) return <RecoHero item={fallbackItem} />;
  return <RecoBillboard slides={slides} />;
}
