import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useMediaItem, useSimilarItems, useCollectionItems, useJellyfinClient, useSeriesWatchState, useTmdbSeasonEpisodes } from "@tentacle-tv/api-client";
import { detailGallery, galleryIndexOf } from "@tentacle-tv/shared";
import { PageTransition } from "../components/PageTransition";
import { DetailStage } from "../components/detail/DetailStage";
import { DetailTextColumn } from "../components/detail/DetailTextColumn";
import { DetailScoreline } from "../components/detail/DetailScoreline";
import { DetailImageViewer } from "../components/detail/DetailImageViewer";
import { DetailMetadata } from "../components/detail/DetailMetadata";
import { DetailOverview } from "../components/detail/DetailOverview";
import { DetailActions } from "../components/detail/DetailActions";
import { TrailerHelpHint } from "../components/detail/TrailerHelpHint";
import { DetailPoster } from "../components/detail/DetailPoster";
import { DetailOpenOverlay, type TargetRect } from "../components/detail/DetailOpenOverlay";
import { DetailPlaceholder } from "../components/detail/DetailPlaceholder";
import { consumeDetailOrigin, skipsEntrance, type DetailOrigin } from "../components/detail/detailTransition";
import { DetailTitle } from "../components/detail/DetailTitle";
import { DetailSections } from "../components/detail/DetailSections";
import { resolveBackdropId } from "../components/hero/resolveBackdrop";
import { tmdbIdForItem } from "../lib/ratingIdentity";
import { textCascadeDelayed } from "../theme/motion";

// `fadeUp` / `fadeIn` viennent de `theme/motion` — la fiche avait ses propres
// copies, restées à 24 px de course quand la référence est passée à 10. La
// révélation du texte doit être la même d'une page à l'autre, sinon l'écart se
// remarque précisément là où l'on navigue le plus.

export function MediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const client = useJellyfinClient();
  const { data: item, isLoading, isError, isFetching, refetch } = useMediaItem(itemId);
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
  const openOverlay = (
    <DetailOpenOverlay
      origin={origin}
      backdropUrl={backdropUrl}
      target={target}
      onDone={handleOverlayDone}
    />
  );

  if (isLoading || !item) {
    return (
      <>
        {/* L'attente, ou l'échec : une requête en erreur ne tourne plus à vide. */}
        <DetailPlaceholder failed={isError && !item} retrying={isFetching} onRetry={() => void refetch()} />
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
      <div className="min-h-screen bg-surface-0">
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
              <DetailActions item={item} collectionCount={collectionItems?.length} />
              {/* Sous les actions, hors du flux : « Vous ne voyez pas les
                  bandes-annonces ? », seulement quand le serveur est mal réglé. */}
              <TrailerHelpHint item={item} />
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
