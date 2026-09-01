import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLibraries,
  useResumeItems,
  useNextUp,
  useWatchedItems,
  useFeaturedItems,
  useWatchlist,
  useHomeWebSocket,
  useJellyfinClient,
  useHomeLayout,
  useMediaItem,
  notifyUserChange,
} from "@tentacle-tv/api-client";
import { HeroBillboard } from "../components/hero/HeroBillboard";
import { PageTransition } from "../components/PageTransition";
import { ContentErrorState } from "../components/ContentErrorState";
import { HomeRow } from "../components/home/homeRowRegistry";
import type { HomeRowData } from "../components/home/homeRowRegistry";
import { RecoHero } from "../components/reco/RecoHero";
import { useRecoRow } from "@tentacle-tv/api-client";
import { CardDensityProvider } from "../contexts/CardDensityContext";
import { reconcileHomeRows } from "../lib/homeLayout";

/**
 * Accueil configurable : l'ordre, l'activation et la densité des rangées
 * viennent de `HomeLayout` (backend, sync multi-appareils) — plus de liste en
 * dur. Sans réglage stocké, le serveur rend des défauts qui reproduisent
 * l'accueil historique à l'identique (migration silencieuse). Le rendu d'une
 * rangée vit dans le registre (`homeRowRegistry`).
 */
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

  const { data: featured, isLoading: featuredLoading, isError: featuredError } = useFeaturedItems();
  const { data: resumeItems } = useResumeItems();
  const { data: nextUp } = useNextUp();
  const { data: watchlist } = useWatchlist();
  const { data: watchedItems } = useWatchedItems();
  const { data: libraries, isError: librariesError } = useLibraries();
  const { data: layout } = useHomeLayout();

  const heroMode = layout?.heroMode ?? "resume";
  const fixedItem = useMediaItem(heroMode === "fixed" ? layout?.heroFixedItemId ?? undefined : undefined);

  // Réconciliation : l'ordre stocké fait foi, les bibliothèques nouvelles
  // s'ajoutent en fin (actives), les disparues s'effacent.
  const rows = useMemo(
    () =>
      reconcileHomeRows(
        layout?.rows ?? [],
        (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name }))
      ).filter((r) => r.enabled),
    [layout?.rows, libraries]
  );

  const librariesById = useMemo(() => {
    const map: HomeRowData["librariesById"] = new Map();
    (libraries ?? []).forEach((lib, index) =>
      map.set(lib.Id, { id: lib.Id, name: lib.Name, collectionType: lib.CollectionType, index })
    );
    return map;
  }, [libraries]);

  // Hero selon le mode : resume (historique — reprise, sinon aléatoire),
  // random (aléatoire seul), fixed (sélection), reco (meilleure suggestion).
  const heroItems =
    heroMode === "random"
      ? featured ?? []
      : heroMode === "fixed"
        ? fixedItem.data
          ? [fixedItem.data]
          : []
        : resumeItems && resumeItems.length > 0
          ? resumeItems.slice(0, 5)
          : featured ?? [];
  const heroLoading =
    heroMode === "reco" ? false : featuredLoading && !resumeItems && heroMode !== "fixed";

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

  const data: HomeRowData = { resumeItems, nextUp, watchlist, watchedItems, librariesById };

  return (
    <PageTransition>
      <CardDensityProvider value={layout?.cardDensity ?? "normal"}>
        {/* Bannière encadrée. Plus de remontée sous la barre de navigation : la
            nav flotte désormais sur le CADRE, pas sur l'affiche. */}
        {heroMode === "reco" ? (
          <div className="pt-6">
            <RecoHeroSlot />
          </div>
        ) : heroLoading ? (
          <div className="px-[var(--row-gutter-mobile)] pb-6 md:px-[var(--row-gutter-desktop)] md:pb-10">
            <div className="skeleton-shimmer h-[62vh] w-full rounded-[var(--hero-frame-radius)] md:h-[70vh] lg:h-[76vh]" />
          </div>
        ) : (
          <HeroBillboard items={heroItems} />
        )}

        <div className="relative z-10 space-y-0 pb-24">
          {rows.map((row, i) => (
            <HomeRow key={row.key} rowKey={row.key} animDelay={150 + i * 100} data={data} />
          ))}
        </div>
      </CardDensityProvider>
    </PageTransition>
  );
}

/** Mode héros « recommandations » : la tête de « Pour vous ». */
function RecoHeroSlot() {
  const { data } = useRecoRow("forYou");
  return <RecoHero item={data?.items?.[0]} />;
}
