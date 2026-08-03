import { memo, useCallback } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { LibraryGridCard as CarteWeb } from "@/components/LibraryGridCard";
import { CarteFocusable } from "./CarteFocusable";

interface ProprietesCarteGrille {
  item: MediaItem;
  onNavigate: (id: string) => void;
}

/**
 * Carte de la grille Bibliothèque, rendue atteignable à la télécommande.
 *
 * Même parti que pour les rangées : on enveloppe la carte du web plutôt que de
 * la recopier. Elle est un `<div onClick>` sans `tabIndex` ni `role`, donc
 * invisible au moteur de navigation — mais elle porte sa propre capture
 * d'origine pour la transition de la fiche, son menu contextuel et son garde
 * de survol, qu'il n'y a aucune raison de dupliquer.
 *
 * C'est cet import de l'original par son remplacement qui exige la garde
 * d'identité de `config/substitutionModules.ts` : sans elle, la résolution se
 * substituerait à elle-même et le build partirait en boucle.
 *
 * Pas de maintien ici : dans une grille, l'appui court ouvre déjà la fiche.
 * Un second geste vers la même destination n'apprendrait rien.
 */
export const LibraryGridCard = memo(function CarteGrilleTv({
  item,
  onNavigate,
}: ProprietesCarteGrille) {
  // La grille n'a pas de fenêtrage horizontal à épingler : le virtualiseur de
  // `LibraryGrid` travaille par lignes entières, et la ligne qui porte le
  // focus est visible par construction.
  const sansEpinglage = useCallback(() => undefined, []);

  return (
    <CarteFocusable
      index={0}
      largeur={null}
      itemId={item.Id}
      maintienOuvreFiche={false}
      onIndexActif={sansEpinglage}
    >
      <CarteWeb item={item} onNavigate={onNavigate} />
    </CarteFocusable>
  );
});
