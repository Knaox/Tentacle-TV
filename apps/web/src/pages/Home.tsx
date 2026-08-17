import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLibraries,
  useResumeItems,
  useLatestItems,
  useNextUp,
  useWatchedItems,
  useFeaturedItems,
  useWatchlist,
  useHomeWebSocket,
  useJellyfinClient,
  notifyUserChange,
} from "@tentacle-tv/api-client";
import { HeroBillboard } from "../components/hero/HeroBillboard";
import { MediaRow } from "../components/rows/MediaRow";
import { ContinueWatchingRow } from "../components/rows/ContinueWatchingRow";
import { PageTransition } from "../components/PageTransition";
import { ContentErrorState } from "../components/ContentErrorState";
import { useNearViewport } from "../hooks/useNearViewport";
import { useDataSaverActive } from "../offline/useDataSaver";

export function Home() {
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const wsToken = client.getAccessToken() || localStorage.getItem("tentacle_token");
  // Révocation explicite de l'appareil, poussée par le serveur (session:revoked) :
  // purge immédiate de la session locale. Inerte sur navigateur desktop — le
  // serveur ne cible que les sockets d'appareils jumelés (TV webOS notamment).
  const onSessionRevoked = useCallback(() => {
    client.setAccessToken(null);
    localStorage.removeItem("tentacle_token");
    localStorage.removeItem("tentacle_user");
    queryClient.clear();
    notifyUserChange();
  }, [client, queryClient]);
  useHomeWebSocket({ token: wsToken, onSessionRevoked });
  const { t } = useTranslation("common");
  const { data: featured, isLoading: featuredLoading, isError: featuredError } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: watchlist } = useWatchlist();
  const { data: watchedItems } = useWatchedItems();
  const { data: libraries, isError: librariesError } = useLibraries();

  // Hero: prioritize resume items (quick resume), fallback to featured
  const heroItems = resumeItems && resumeItems.length > 0
    ? resumeItems.slice(0, 5)
    : featured ?? [];
  const heroLoading = featuredLoading && !resumeItems;

  // Les deux requêtes qui portent la page : sans bibliothèques NI mise en avant,
  // il ne reste rien à afficher. On le DIT, au lieu de rendre une page vide qui
  // ressemble à une bibliothèque sans contenu.
  const nothingLoaded = librariesError && featuredError && !resumeItems?.length;
  if (nothingLoaded) {
    return (
      <PageTransition>
        <ContentErrorState />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {/* Bannière encadrée. Plus de remontée sous la barre de navigation : la
          nav flotte désormais sur le CADRE, pas sur l'affiche. C'est ce qui
          donne au cadre ses quatre côtés — sans quoi la bannière toucherait le
          haut de l'écran et il n'en resterait que trois. */}
      {heroLoading ? (
        <div className="px-[var(--row-gutter-mobile)] pb-6 md:px-[var(--row-gutter-desktop)] md:pb-10">
          <div className="skeleton-shimmer h-[62vh] w-full rounded-[var(--hero-frame-radius)] md:h-[70vh] lg:h-[76vh]" />
        </div>
      ) : (
        <HeroBillboard items={heroItems} />
      )}

      {/* Rangées. Plus de chevauchement négatif non plus : il masquait la
          couture d'une bannière à fond perdu, qui n'existe plus. */}
      <div className="relative z-10 space-y-0 pb-24">
        {resumeItems && resumeItems.length > 0 && (
          <ContinueWatchingRow
            title={t("common:resumeWatching")}
            items={resumeItems}
            animDelay={150}
          />
        )}
        {nextUp && nextUp.length > 0 && (
          <ContinueWatchingRow
            title={t("common:nextEpisodes")}
            items={nextUp}
            animDelay={250}
          />
        )}
        {watchlist && watchlist.length > 0 && (
          <MediaRow
            title={t("common:myList")}
            items={watchlist}
            animDelay={350}
            href="/watchlist"
          />
        )}
        {watchedItems && watchedItems.length > 0 && (
          <MediaRow
            title={t("common:alreadyWatched")}
            items={watchedItems}
            variant="episode"
            animDelay={450}
          />
        )}
        {libraries?.map((lib, i) => (
          <LibraryRow
            key={lib.Id}
            libraryId={lib.Id}
            libraryName={lib.Name}
            collectionType={lib.CollectionType}
            delayIndex={i}
          />
        ))}
      </div>
    </PageTransition>
  );
}

function LibraryRow({
  libraryId,
  libraryName,
  collectionType,
  delayIndex,
}: {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
  delayIndex: number;
}) {
  const { t } = useTranslation("common");
  const dataSaver = useDataSaverActive();
  // On ne lance la requête qu'à l'approche de la rangée — en économie COMME en
  // connexion rapide. Le lazy loading de MediaRow ne gouverne que le RENDU :
  // les données des rangées hors écran descendaient quand même, et télécharger
  // ce que l'utilisateur ne verra peut-être jamais est un gaspillage sans
  // contrepartie. Seule la marge d'anticipation dépend du mode : très large en
  // temps normal (les rangées d'un écran classique restent toutes chargées
  // d'emblée, l'arrivée est invisible), resserrée quand chaque octet compte.
  const { ref, near } = useNearViewport<HTMLElement>(dataSaver ? "600px" : "1400px");
  const enabled = near;
  const { data: items, isLoading } = useLatestItems(libraryId, { collectionType, enabled });

  // Squelette tant que la requête n'a pas abouti. Il porte AUSSI la cible de
  // l'observer : sans un élément monté, une rangée en attente ne serait jamais
  // déclenchée et resterait vide indéfiniment.
  if (!enabled || isLoading) {
    return (
      <section ref={ref} className="row-gutter mb-10">
        <h2 className="mb-3 text-base font-semibold text-content-primary md:text-lg">
          {t("common:latestAdditions", { name: libraryName })}
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

  if (!items || items.length === 0) return null;

  return (
    <MediaRow
      title={t("common:latestAdditions", { name: libraryName })}
      items={items}
      animDelay={550 + delayIndex * 80}
      href={`/library/${libraryId}`}
      posterImageMode="series"
    />
  );
}
