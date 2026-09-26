import { useMemo, type ReactNode } from "react";
import type { RecoHeroSelection } from "@tentacle-tv/api-client";
import { RecoHero } from "@/components/reco/RecoHero";
import { RecoBillboard } from "@/components/reco/hero/RecoBillboard";

interface RecoBillboardSlotProps {
  hero: RecoHeroSelection;
  fallback?: ReactNode;
}

/**
 * La bannière « Sélectionné pour vous » de l'accueil, BIBLIOTHÈQUE SEULE.
 *
 * En mode héros « reco », l'accueil du web fait défiler les meilleures
 * suggestions du moteur, titres « à la demande » compris : une affiche TMDB,
 * une pastille, et un renvoi vers la fiche Vigie. Sur un téléviseur, ce renvoi
 * ne mène nulle part — pas de catalogue d'extension à trois mètres — et la
 * bannière mettait en avant, tout en haut de l'écran, un film qu'on ne peut
 * pas regarder.
 *
 * On garde donc la règle déjà tenue par « Pour vous » et par les rangées
 * `reco:*` du téléviseur (`recoMediaItem.ts`) : ce qui n'est pas sur le
 * serveur ne s'affiche pas. Sans aucun titre de la bibliothèque parmi les
 * diapositives, c'est la bannière de repli de l'accueil qui prend la place —
 * jamais un cadre vide.
 */
export function RecoBillboardSlot({ hero, fallback }: RecoBillboardSlotProps) {
  const slides = useMemo(
    () => hero.slides.filter((slide) => slide.jellyfinItemId),
    [hero.slides],
  );
  const fallbackItem = hero.fallbackItem?.jellyfinItemId ? hero.fallbackItem : undefined;

  if (slides.length > 0) {
    return (
      <div className="pt-6">
        <RecoBillboard slides={slides} />
      </div>
    );
  }
  if (fallbackItem) {
    return (
      <div className="pt-6">
        <RecoHero item={fallbackItem} />
      </div>
    );
  }
  return <>{fallback ?? null}</>;
}
