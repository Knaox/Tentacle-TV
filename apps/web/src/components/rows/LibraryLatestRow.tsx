import { useTranslation } from "react-i18next";
import { useLatestItems } from "@tentacle-tv/api-client";
import { MediaRow } from "./MediaRow";
import { RowErrorState } from "./RowErrorState";
import { useNearViewport } from "../../hooks/useNearViewport";
import { useDataSaverActive } from "../../offline/useDataSaver";

interface LibraryLatestRowProps {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
  delayIndex: number;
}

/**
 * « Derniers ajouts » d'UNE bibliothèque. Extraite de Home.tsx (l'accueil
 * configurable rend les rangées par registre) — comportement identique.
 *
 * On ne lance la requête qu'à l'approche de la rangée — en économie COMME en
 * connexion rapide. Le lazy loading de MediaRow ne gouverne que le RENDU :
 * les données des rangées hors écran descendaient quand même, et télécharger
 * ce que l'utilisateur ne verra peut-être jamais est un gaspillage sans
 * contrepartie. Seule la marge d'anticipation dépend du mode : très large en
 * temps normal (les rangées d'un écran classique restent toutes chargées
 * d'emblée, l'arrivée est invisible), resserrée quand chaque octet compte.
 */
export function LibraryLatestRow({
  libraryId,
  libraryName,
  collectionType,
  delayIndex,
}: LibraryLatestRowProps) {
  const { t } = useTranslation("common");
  const dataSaver = useDataSaverActive();
  const { ref, near } = useNearViewport<HTMLElement>(dataSaver ? "600px" : "1400px");
  const enabled = near;
  const {
    data: items,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useLatestItems(libraryId, { collectionType, enabled });
  const title = t("common:latestAdditions", { name: libraryName });

  // Squelette tant que la requête n'a pas abouti. Il porte AUSSI la cible de
  // l'observer : sans un élément monté, une rangée en attente ne serait jamais
  // déclenchée et resterait vide indéfiniment.
  if (!enabled || isLoading) {
    return (
      <section ref={ref} className="row-gutter mb-10">
        <h2 className="mb-3 text-base font-semibold text-content-primary md:text-lg">
          {title}
        </h2>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-shimmer aspect-[2/3] w-32 flex-shrink-0 rounded-md sm:w-44 lg:w-52"
            />
          ))}
        </div>
      </section>
    );
  }

  // ÉCHEC et VIDE ne se ressemblent pas, et se rendaient pareil — `null`, la
  // rangée effacée sans un mot. Une bibliothèque sans nouveauté n'a rien à
  // dire ; une requête tombée, si : elle garde sa place, son titre, et propose
  // de réessayer (voir `RowErrorState`, qui se tait de lui-même hors ligne).
  if (isError) {
    return (
      <RowErrorState
        title={title}
        retrying={isFetching}
        onRetry={() => { void refetch(); }}
      />
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <MediaRow
      title={title}
      items={items}
      animDelay={550 + delayIndex * 80}
      href={`/library/${libraryId}`}
      posterImageMode="series"
    />
  );
}
