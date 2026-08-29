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
  title,
  items,
  isLoading,
  messageVide,
  emptyHint,
  icon,
}: {
  title: string;
  items: ReturnType<typeof useWatchlistAll>["data"];
  isLoading: boolean;
  messageVide: string;
  emptyHint: string;
  icon?: React.ReactNode;
}) {
  const selection = useMultiSelect();

  return (
    <PageTransition>
      {/* `relative z-10` n'est pas décoratif : c'est ce qui remet cette page
          AU-DESSUS du décor de la carte visée.

          `FocusBackdropTv` couvre l'écran en `position: fixed; z-index: 0`, et le
          commentaire de `cards-tv.css` supposait que cela suffisait à le
          garder sous le contenu. C'est faux en CSS : dans une même pile, un
          élément POSITIONNÉ à `z-index: 0` est peint après tout contenu
          statique. Les cartes, qui sont `relative`, restaient donc devant —
          mais le titre de la page et ses onglets, qui ne le sont pas,
          passaient dessous, sous une image à 0,55 d'opacité et un voile qui
          finit opaque. D'où « le focus d'une carte cache les filtres ».

          L'accueil (`Home.tsx`) et les bibliothèques (`Library.tsx`) ont ce
          conteneur depuis toujours ; ces deux pages-ci ne l'ont jamais eu, et
          ce sont aussi les seules du parcours à n'avoir pas de bannière —
          leur titre commence tout en haut, là où le décor est le plus dense. */}
      <div className="collections-tv relative z-10 min-h-screen pb-20">
        <CollectionGrid
          title={title}
          items={items}
          isLoading={isLoading}
          emptyMessage={messageVide}
          emptyHint={emptyHint}
          emptyIcon={icon}
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
      title={t("common:myList")}
      items={items}
      isLoading={isLoading}
      messageVide={t("common:emptyWatchlist")}
      emptyHint={t("common:emptyWatchlistHint")}
      icon={
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
      }
    />
  );
}

export function Favorites() {
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useFavoritesAll();

  return (
    <CollectionTv
      title={t("common:myFavorites")}
      items={items}
      isLoading={isLoading}
      messageVide={t("common:emptyFavorites")}
      emptyHint={t("common:emptyFavoritesHint")}
    />
  );
}
