import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useMediaItem, useSimilarItems, useCollectionItems, useJellyfinClient, useSeriesWatchState, useTmdbSeasonEpisodes } from "@tentacle-tv/api-client";
import { DETAIL_SEASON_PARAM, detailGallery, galleryIndexOf } from "@tentacle-tv/shared";
import { PageTransition } from "../components/PageTransition";
import { DetailStage } from "../components/detail/DetailStage";
import { DetailTextColumn } from "../components/detail/DetailTextColumn";
import { DetailScoreline } from "../components/detail/DetailScoreline";
import { DetailImageViewer } from "../components/detail/DetailImageViewer";
import { DetailMetadata } from "../components/detail/DetailMetadata";
import { DetailOverview } from "../components/detail/DetailOverview";
import { MetadataHint } from "../components/detail/MetadataHint";
import { DetailActions } from "../components/detail/DetailActions";
import { DetailPoster } from "../components/detail/DetailPoster";
import { DetailOpenOverlay, type TargetRect } from "../components/detail/DetailOpenOverlay";
import { PreviewLaunchOverlay } from "../components/detail/PreviewLaunchOverlay";
import { DetailPlaceholder } from "../components/detail/DetailPlaceholder";
import { consumeDetailOrigin, skipsEntrance, type DetailOrigin } from "../components/detail/detailTransition";
import { DetailTitle } from "../components/detail/DetailTitle";
import { detailLogoUrl, detailPosterUrl } from "../components/detail/detailArtUrls";
import { useDetailArrival } from "../components/detail/detailArrival";
import { DetailSections } from "../components/detail/DetailSections";
import { resolveBackdropId } from "../components/hero/resolveBackdrop";
import { tmdbIdForItem } from "../lib/ratingIdentity";
import { textCascadeDelayed } from "../theme/motion";

// `fadeUp` / `fadeIn` viennent de `theme/motion` — la fiche avait ses propres
// copies, restées à 24 px de course quand la référence est passée à 10. La
// révélation du texte doit être la même d'une page à l'autre, sinon l'écart se
// remarque précisément là où l'on navigue le plus.

/** La fiche sous un calque d'ouverture pas encore opaque : présente, mesurable, invisible. */
const HIDDEN_UNDER_OVERLAY = { visibility: "hidden" } as const;

export function MediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  // Une carte regroupée des « Derniers ajouts » ouvre la série sur une saison.
  const [searchParams] = useSearchParams();
  const client = useJellyfinClient();
  const { data: item, isLoading, isError, error, isFetching, refetch } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  // Note TMDB de l'épisode (fiche épisode) : lue par saison, cache partagé
  // avec la liste plus bas ; Jellyfin en repli.
  const seriesTmdbId = tmdbIdForItem(isEpisode ? parentSeries : item);
  const { data: tmdbSeasonEpisodes } = useTmdbSeasonEpisodes(
    isEpisode ? seriesTmdbId : null,
    isEpisode ? (item?.ParentIndexNumber ?? null) : null,
  );
  const episodeCommunityRating =
    isEpisode && item?.IndexNumber != null
      ? (tmdbSeasonEpisodes?.get(item.IndexNumber)?.voteAverage ?? item.CommunityRating ?? null)
      : undefined;
  // Sur une fiche SÉRIE, on récupère l'épisode "à reprendre" pour le surligner
  // dans la liste (même traitement que l'épisode courant sur une fiche épisode).
  const { data: seriesWatchState } = useSeriesWatchState(item?.Type === "Series" ? item.Id : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  // Collection (BoxSet) : contenu navigable de la collection
  const { data: collectionItems } = useCollectionItems(item?.Type === "BoxSet" ? item.Id : undefined);

  // Vue « image plein écran » : l'index de l'image montrée, `null` = fermée.
  // Refermée à chaque changement de fiche (le composant est réutilisé).
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const gallery = useMemo(() => (item ? detailGallery(item) : []), [item]);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

  // Origine de l'ouverture : le rectangle du visuel cliqué, capturé juste avant
  // la navigation.
  const [origin, setOrigin] = useState<DetailOrigin | null>(() => consumeDetailOrigin(itemId));

  /**
   * La page rend son état FINAL d'emblée quand elle ne s'OUVRE pas : calque en
   * charge, sortie du lecteur, ou document chargé directement sur cette fiche.
   * Les trois cas et leur pourquoi sont dans `skipsEntrance`.
   *
   * `useRef` et non l'état : `origin` retombe à null dès que le calque a fini,
   * et l'entrée ne doit surtout pas se déclencher à ce moment-là.
   */
  const skipEntrance = useRef(skipsEntrance(origin));
  /**
   * Le calque d'ouverture est OPAQUE (son fond a fini de monter). Avant, la
   * fiche, rendue d'emblée dans son état final, se voyait à travers ce fond
   * encore transparent — un éclair de la page d'arrivée avant le vol, d'autant
   * plus long que la page quittée s'efface vite. Cachée jusque-là (sans rien
   * changer à sa mise en page : le vol vise ses mesures), elle est ensuite
   * dessous, invisible, jusqu'à l'effacement du calque.
   */
  const [overlayCovered, setOverlayCovered] = useState(false);
  const handleOverlayCovered = useCallback(() => setOverlayCovered(true), []);
  // Animations réduites : aucun calque ne se joue, la fiche se montre tout de suite.
  const reducedMotion = useReducedMotion() === true;
  const pageStyle = origin !== null && !overlayCovered && !reducedMotion ? HIDDEN_UNDER_OVERLAY : undefined;

  // Relue à CHAQUE changement d'item, et pas seulement au montage. React Router
  // réutilise ce composant d'une fiche à l'autre — un initialiseur `useState` ne
  // s'y rejoue pas —, si bien que passer d'une fiche à une fiche similaire
  // n'animait rien du tout. La lecture est non destructive et rend le même objet
  // tant que rien n'a été recapturé : la rejouer est sans effet.
  useEffect(() => {
    const next = consumeDetailOrigin(itemId);
    setOrigin(next);
    setTarget(null);
    setViewerIndex(null);
    setOverlayCovered(false);
    // Le composant étant réutilisé d'une fiche à l'autre, le régime d'entrée
    // doit suivre l'item courant : la fiche suivante peut très bien s'ouvrir
    // sans transition (lien direct) après une qui en avait une.
    skipEntrance.current = skipsEntrance(next);
  }, [itemId]);
  // Place finale du visuel, remontée par `DetailPoster` une fois la mise en
  // page faite : c'est la cible du vol. `useCallback` pour ne pas relancer la
  // mesure à chaque rendu de la page.
  const [target, setTarget] = useState<TargetRect | null>(null);
  /**
   * La cible est remontée à chaque changement de taille du visuel, pas une
   * seule fois — et la plupart de ces remontées donnent le MÊME rectangle
   * (mise en page qui se stabilise, police qui arrive, image qui se décode).
   * Sans cette comparaison, chacune crée un objet neuf, donc un rendu de la
   * page, donc un nouveau `target` pour le calque : l'animation se relançait en
   * boucle et clignotait.
   */
  const handleMeasure = useCallback((rect: TargetRect) => {
    setTarget((prev) =>
      prev && prev.top === rect.top && prev.left === rect.left
        && prev.width === rect.width && prev.height === rect.height
        ? prev
        : rect,
    );
  }, []);
  /** Stable : passé en dépendance de l'effet qui LANCE l'animation du calque. */
  const handleOverlayDone = useCallback(() => setOrigin(null), []);

  // Calculé AVANT le retour anticipé : le calque d'ouverture en a besoin, et il
  // doit rester au même index de fragment dans les deux branches (React
  // réconcilie par position — le déplacer le remonterait, coupant l'animation).
  const overlayBackdropId = item ? resolveBackdropId(item) : null;
  const backdropUrl = overlayBackdropId
    ? client.getImageUrl(overlayBackdropId, "Backdrop", { width: 1920, quality: 85 })
    : null;
  /**
   * L'ARRIVÉE : décor, affiche et logo décodés avant que la fiche se montre
   * (`detailArrival.ts`, 800 ms au plus). Sous un calque d'ouverture, c'est lui
   * qui attend avant de s'effacer ; sans calque, le fond seul tient la place,
   * puis toute l'entrée part d'un bloc. Jamais une image qui surgit après.
   */
  const arrivalReady = useDetailArrival(item?.Id ?? null, [
    backdropUrl, item ? detailPosterUrl(client, item) : null, item ? detailLogoUrl(client, item) : null,
  ]);
  // Une fiche déjà montrée ne se recache jamais (un calque qui s'efface avant la porte, par son garde-fou).
  const shownFor = useRef<string | null>(null);
  const overlayInCharge = origin !== null && !reducedMotion;
  const holding = !!item && !arrivalReady && !overlayInCharge && shownFor.current !== item.Id;
  if (item && !holding) shownFor.current = item.Id;
  // Depuis une mini-carte d'aperçu, c'est sa vidéo qui grandit jusqu'à la
  // scène (`PreviewLaunchOverlay`) ; depuis une carte, son visuel qui vole
  // jusqu'à l'affiche. Une clé par ouverture : la suivante repart de zéro.
  const openOverlay = origin?.launch ? (
    <PreviewLaunchOverlay
      key={origin.stamp}
      launch={origin.launch}
      backdropUrl={backdropUrl}
      settled={!!item}
      ready={arrivalReady}
      onCovered={handleOverlayCovered}
      onDone={handleOverlayDone}
    />
  ) : (
    <DetailOpenOverlay
      origin={origin}
      backdropUrl={backdropUrl}
      target={target}
      settled={!!item}
      ready={arrivalReady}
      onCovered={handleOverlayCovered}
      onDone={handleOverlayDone}
    />
  );

  if (isLoading || !item || holding) {
    return (
      <>
        {/* L'attente, ou l'échec : une requête en erreur ne tourne plus à vide. */}
        <div style={pageStyle}>
          <DetailPlaceholder quiet={holding} failed={isError && !item} error={error} retrying={isFetching} onRetry={() => void refetch()} />
        </div>
        {/* Le calque d'ouverture couvre l'écran pendant le chargement : sans
            lui ici, un aller-retour spinner → fiche crevait l'animation. */}
        {openOverlay}
      </>
    );
  }

  const isSeries = item.Type === "Series";
  // Liste saisons/épisodes : sur une série (son propre id) comme sur un épisode
  // (id de la série parente), afin de situer l'épisode courant dans la saison.
  const episodeListSeriesId = isSeries ? itemId : isEpisode ? item.SeriesId : undefined;
  // Épisode à surligner dans la liste : l'épisode courant (fiche épisode) ou
  // l'épisode "à reprendre" (fiche série).
  const seriesResumeEp = isSeries && seriesWatchState && seriesWatchState.type !== "completed"
    ? seriesWatchState.episode
    : undefined;
  const highlightEpisodeId = isEpisode ? item.Id : seriesResumeEp?.Id;
  const highlightSeasonId = isEpisode ? item.SeasonId : seriesResumeEp?.SeasonId;
  const openSeasonId = isSeries ? searchParams.get(DETAIL_SEASON_PARAM) ?? undefined : undefined;
  const openImages = gallery.length > 0 ? () => setViewerIndex(0) : undefined;
  const openPoster = gallery.length > 0
    ? () => setViewerIndex(galleryIndexOf(gallery, isEpisode ? "still" : "poster"))
    : undefined;

  return (
    <>
    {/* Voile de page neutralisé quand la fiche ne s'ouvre pas : il déplace la
        page de 12 px et l'échelonne à 99,5 % SOUS le calque, mouvement que
        personne ne voit et qui n'a plus qu'à finir au mauvais moment. */}
    <PageTransition skip={skipEntrance.current}>
      <div className="min-h-screen bg-surface-0" style={pageStyle}>
        <DetailStage backdropUrl={backdropUrl} item={item} instant={skipEntrance.current} onOpenImages={openImages}>
          <motion.div
            className="flex items-end gap-8 px-5 pb-10 pt-28 md:px-12 md:pb-14 xl:gap-12 xl:px-16"
            // `initial={false}` quand la page ne s'ouvre pas : le contenu rend son
            // état FINAL d'emblée. Sinon la cascade se joue sous le calque,
            // invisible, et il ne lui reste plus qu'à se terminer au mauvais
            // moment — c'est le défaut d'ouverture.
            initial={skipEntrance.current ? false : "hidden"}
            animate="show"
            // Constante de module (cf. `theme/motion`), jamais un littéral en
            // ligne : un objet neuf à chaque rendu fait rejouer toute la cascade
            // par framer, et cette page se rend plusieurs fois — mesure du visuel,
            // arrivée des requêtes.
            variants={textCascadeDelayed}
          >
            <DetailPoster
              item={item}
              onMeasure={handleMeasure}
              instant={skipEntrance.current}
              onOpen={openPoster}
            />

            <DetailTextColumn>
              <DetailTitle item={item} collectionCount={collectionItems?.length} />
              <DetailScoreline item={item} communityRating={episodeCommunityRating} />
              <DetailMetadata item={item} />
              <DetailOverview item={item} />
              {/* Titre que Jellyfin n'a pas trouvé : le dire, sans rien bloquer. */}
              <MetadataHint item={item} />
              <DetailActions item={item} collectionCount={collectionItems?.length} />
            </DetailTextColumn>
          </motion.div>
        </DetailStage>

        <DetailSections
          item={item}
          parentSeries={parentSeries}
          collectionItems={collectionItems}
          similar={similar}
          episodeListSeriesId={episodeListSeriesId}
          highlightEpisodeId={highlightEpisodeId}
          highlightSeasonId={highlightSeasonId}
          openSeasonId={openSeasonId}
        />
      </div>
    </PageTransition>
    {openOverlay}
    <DetailImageViewer
      title={item.Name}
      gallery={gallery}
      index={viewerIndex}
      onIndexChange={setViewerIndex}
      onClose={closeViewer}
    />
    </>
  );
}
