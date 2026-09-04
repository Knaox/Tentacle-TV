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
  reconcileHomeRows,
  visibleHomeRows,
  useRecoPage,
  firstServedRecoRowKey,
} from "@tentacle-tv/api-client";
import { HeroBillboard } from "../components/hero/HeroBillboard";
import { PageTransition } from "../components/PageTransition";
import { ContentErrorState } from "../components/ContentErrorState";
import { HomeRow } from "../components/home/homeRowRegistry";
import type { HomeRowData } from "../components/home/homeRowRegistry";
import { RecoBillboardSlot } from "../components/reco/hero/RecoBillboardSlot";
import { useRecoHeroSlides } from "../components/reco/hero/recoHeroSlides";
import { CardDensityProvider } from "../contexts/CardDensityContext";
import { useRecoFilter } from "../hooks/useRecoFilter";

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
  // Héros « reco » : LA page du filtre du compte — celle de la page
  // Recommandations et des rangées reco:* de l'accueil (aucune requête en
  // plus). Le filtre suit sur l'accueil comme en face.
  const { selected: recoFilter } = useRecoFilter();
  const recoHero = useRecoHeroSlides(recoFilter, { enabled: heroMode === "reco" });
  const fixedItem = useMediaItem(heroMode === "fixed" ? layout?.heroFixedItemId ?? undefined : undefined);

  // Réconciliation : l'ordre stocké fait foi, les bibliothèques nouvelles
  // s'ajoutent en fin (actives), les disparues s'effacent. Sur le DÉFAUT non
  // stocké, elles s'ancrent avant « Déjà visionné » (ordre cible de l'accueil
  // recommandé). Seules les rangées du catalogue serveur se rendent : une
  // rangée que ce serveur ne sait pas servir (pas de clé TMDB) reste stockée
  // mais ne s'affiche pas.
  const rows = useMemo(
    () =>
      visibleHomeRows(
        reconcileHomeRows(
          layout?.rows ?? [],
          (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name })),
          { anchorNewLibraries: layout?.stored === false, catalog: layout?.catalog }
        ),
        layout?.catalog
      ).filter((r) => r.enabled),
    [layout?.rows, layout?.stored, layout?.catalog, libraries]
  );

  // La puce du filtre de plateformes : sur la première rangée reco, dans
  // l'ordre de l'accueil, RÉELLEMENT servie sous ce filtre — la page est la
  // même entrée de cache que les rangées et le héros, aucune requête en plus.
  const hasRecoRows = rows.some((r) => r.key.startsWith("reco:"));
  const { data: recoPage } = useRecoPage(recoFilter, { enabled: heroMode === "reco" || hasRecoRows });
  const filterChipRowKey = useMemo(
    () =>
      recoFilter.length > 0 && recoPage
        ? firstServedRecoRowKey(rows, recoPage.rows.map((r) => r.key))
        : null,
    [recoFilter, recoPage, rows]
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
  const heroLoading = featuredLoading && !resumeItems && heroMode !== "fixed";

  // Repli du mode reco : la bannière de REPRISE tant que la reco n'a rien à
  // montrer (chargement, profil froid, perso coupée, serveur sans clé TMDB).
  // Mêmes gabarits partagés (CARD_HEIGHT/FRAME_GUTTER) : la bascule vers le
  // carrousel reco se fait sans saut.
  const heroSkeleton = (
    <div className="px-[var(--row-gutter-mobile)] pb-6 md:px-[var(--row-gutter-desktop)] md:pb-10">
      <div className="skeleton-shimmer h-[62vh] w-full rounded-[var(--hero-frame-radius)] md:h-[70vh] lg:h-[76vh]" />
    </div>
  );

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

  // « Pour vous » saute les diapositives du bandeau « reco » — la règle de la
  // page Recommandations, pour que les deux rangées disent la même chose. Un
  // autre bandeau ne cache rien : la rangée est alors complète.
  const data: HomeRowData = {
    resumeItems,
    nextUp,
    watchlist,
    watchedItems,
    librariesById,
    heroExcludeKeys: heroMode === "reco" ? recoHero.excludeKeys : undefined,
    filterChipRowKey,
  };

  return (
    <PageTransition>
      <CardDensityProvider value={layout?.cardDensity ?? "normal"}>
        {/* Bannière encadrée. Plus de remontée sous la barre de navigation : la
            nav flotte désormais sur le CADRE, pas sur l'affiche. */}
        {heroMode === "reco" ? (
          <RecoBillboardSlot
            hero={recoHero}
            fallback={heroLoading ? heroSkeleton : <HeroBillboard items={heroItems} />}
          />
        ) : heroLoading ? (
          heroSkeleton
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
