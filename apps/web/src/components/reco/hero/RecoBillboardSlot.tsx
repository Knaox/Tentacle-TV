import type { ReactNode } from "react";
import { RecoHero } from "../RecoHero";
import { RecoBillboard } from "./RecoBillboard";
import type { RecoHeroSelection } from "./recoHeroSlides";

interface RecoBillboardSlotProps {
  /** La sélection du héros (useRecoHeroSlides) — l'appelant passe la page du
   *  filtre du compte : la page Recommandations comme l'accueil. */
  hero: RecoHeroSelection;
  /** Rendu quand la reco n'a RIEN à montrer (chargement, profil froid, perso
   *  coupée, serveur sans clé TMDB) : la bannière de reprise sur l'accueil,
   *  l'en-tête compact sur la page Recommandations. Rendu NU — le pt-6 du
   *  héros reco ne s'applique qu'au contenu reco. */
  fallback?: ReactNode;
}

/**
 * LE point de vérité du héros de recommandations, partagé entre la page
 * Recommandations et l'accueil (mode héros « reco ») : le carrousel quand des
 * diapositives à visuel large existent, sinon l'ancienne carte héros en repli
 * (phase préliminaire sans backdrops, vieux pools) — et le `fallback` fourni
 * par l'appelant tant qu'aucun item n'est servi : plus jamais de trou vide.
 */
export function RecoBillboardSlot({ hero, fallback }: RecoBillboardSlotProps) {
  if (hero.slides.length > 0) {
    return (
      <div className="pt-6">
        <RecoBillboard slides={hero.slides} />
      </div>
    );
  }
  if (hero.fallbackItem) {
    return (
      <div className="pt-6">
        <RecoHero item={hero.fallbackItem} />
      </div>
    );
  }
  return <>{fallback ?? null}</>;
}
