import { memo, useCallback } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { CollectionGridCard as CarteWeb } from "@/components/collection/CollectionGridCard";
import type { SelectionMode } from "@/components/collection/selectionMode";
import { CarteFocusable } from "./CarteFocusable";

interface ProprietesCarteCollection {
  item: MediaItem;
  onNavigate: (id: string) => void;
  selectionMode?: SelectionMode;
}

/**
 * Carte des grilles Ma liste et Favoris, rendue atteignable à la télécommande.
 *
 * Ces deux écrans étaient des culs-de-sac : mesuré sur `/tv/favorites`, cinq
 * éléments focusables hors rail — le retour et les quatre filtres — et **zéro
 * carte**, alors qu'une carte s'affichait. La cause est celle déjà rencontrée
 * ailleurs : la carte du web est un `<div onClick>` sans `tabIndex` ni `role`,
 * donc invisible au recensement du moteur.
 *
 * La mise en page, elle, n'avait rien : `CollectionGridBody` importe
 * `useItemsPerRow`, qui est substitué, donc `data-tv-grille` est bien posé et
 * `grille-tv.css` s'applique déjà. Il ne manquait que la focusabilité — d'où
 * une enveloppe, et non un fork.
 *
 * C'est mot pour mot le motif de `CarteGrilleTv`, à une propriété près :
 * `selectionMode` doit être passé tel quel. L'appui court de `CarteFocusable`
 * rejoue un vrai clic sur la carte enveloppée, donc la sélection multiple, la
 * capture d'origine pour la transition de fiche et la garde du menu contextuel
 * continuent de fonctionner sans qu'on en duplique une ligne.
 *
 * Effet de bord voulu : la carte reçoit enfin `.carte-tv`, donc l'agrandissement
 * au focus et le `.hover-reveal { display: none }` de `cartes-tv.css`, dont ces
 * deux écrans étaient privés.
 */
export const CollectionGridCard = memo(function CarteCollectionTv({
  item,
  onNavigate,
  selectionMode,
}: ProprietesCarteCollection) {
  // Comme pour la bibliothèque : le virtualiseur travaille par lignes entières,
  // celle qui porte le focus est visible par construction, il n'y a pas de
  // fenêtrage horizontal à épingler.
  const sansEpinglage = useCallback(() => undefined, []);

  return (
    <CarteFocusable
      index={0}
      largeur={null}
      itemId={item.Id}
      item={item}
      onIndexActif={sansEpinglage}
    >
      <CarteWeb item={item} onNavigate={onNavigate} selectionMode={selectionMode} />
    </CarteFocusable>
  );
});
