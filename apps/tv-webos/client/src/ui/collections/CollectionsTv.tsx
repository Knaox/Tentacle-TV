import { useTranslation } from "react-i18next";
import { useWatchlistAll, useFavoritesAll } from "@tentacle-tv/api-client";
import { CollectionGrid } from "@/components/CollectionGrid";
import { PageTransition } from "@/components/PageTransition";
import { useMultiSelect } from "@/hooks/useMultiSelect";

/**
 * Ma liste et Mes favoris, pour une télécommande.
 *
 * Les deux pages du web sont de simples compositions autour de
 * `CollectionGrid` — une soixantaine de lignes chacune, dont l'essentiel sert
 * la sélection multiple. On les remplace par la même composition, moins ce qui
 * n'a pas de sens à trois mètres. Les deux tiennent dans un fichier : elles ne
 * diffèrent que par la source des éléments et deux libellés.
 *
 * **La sélection multiple part.** Elle demande un mode, un curseur et une barre
 * d'actions flottante : trois niveaux de navigation pour un geste
 * d'administration. Pire, l'audit l'a mesuré, y entrer sortait TOUTES les cartes
 * du parcours du D-pad — elles devenaient des cases à cocher — et la seule issue
 * était un « Annuler » qu'il fallait avoir vu.
 *
 * **Le partage part aussi**, et c'était le plus grave des deux. Le bouton
 * ouvrait une modale qui déclare `role="dialog"` — donc où le moteur confine le
 * focus — sans offrir le moindre bouton de fermeture. Aucune issue à la
 * télécommande. Un lien à recopier ou à envoyer ne se manipule de toute façon
 * pas depuis un canapé.
 *
 * `useMultiSelect` reste appelé et passé à la grille : sans le bouton qui
 * l'active, le mode ne peut plus être atteint, et la grille garde le contrat
 * qu'elle attend. Retirer la propriété aurait demandé de toucher `CollectionGrid`,
 * qui est du code du web.
 */

function CollectionTv({
  titre,
  items,
  isLoading,
  messageVide,
  indiceVide,
  icone,
}: {
  titre: string;
  items: ReturnType<typeof useWatchlistAll>["data"];
  isLoading: boolean;
  messageVide: string;
  indiceVide: string;
  icone?: React.ReactNode;
}) {
  const selection = useMultiSelect();

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        <CollectionGrid
          title={titre}
          items={items}
          isLoading={isLoading}
          emptyMessage={messageVide}
          emptyHint={indiceVide}
          emptyIcon={icone}
          selectionMode={selection}
        />
      </div>
    </PageTransition>
  );
}

export function Watchlist() {
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useWatchlistAll();

  return (
    <CollectionTv
      titre={t("common:myList")}
      items={items}
      isLoading={isLoading}
      messageVide={t("common:emptyWatchlist")}
      indiceVide={t("common:emptyWatchlistHint")}
      icone={<span>&#128278;</span>}
    />
  );
}

export function Favorites() {
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useFavoritesAll();

  return (
    <CollectionTv
      titre={t("common:myFavorites")}
      items={items}
      isLoading={isLoading}
      messageVide={t("common:emptyFavorites")}
      indiceVide={t("common:emptyFavoritesHint")}
    />
  );
}
