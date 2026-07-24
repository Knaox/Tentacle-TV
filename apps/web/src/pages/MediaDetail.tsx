import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useMediaItem, useSimilarItems, useCollectionItems, useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import { CastRow } from "../components/CastRow";
import { EpisodeList } from "../components/EpisodeList";
import { MediaRow } from "../components/rows/MediaRow";
import { LicenseAttribution } from "../components/media/LicenseAttribution";
import { TechInfo } from "../components/TechInfo";
import { PageTransition } from "../components/PageTransition";
import { DetailHero } from "../components/detail/DetailHero";
import { DetailMetadata } from "../components/detail/DetailMetadata";
import { DetailOverview } from "../components/detail/DetailOverview";
import { DetailActions } from "../components/detail/DetailActions";
import { DetailPoster } from "../components/detail/DetailPoster";
import { DetailOpenOverlay, type TargetRect } from "../components/detail/DetailOpenOverlay";
import { consumeDetailOrigin, type DetailOrigin } from "../components/detail/detailTransition";
import { ExtrasSection } from "../components/detail/ExtrasSection";
import { resolveBackdropId } from "../components/hero/resolveBackdrop";
import { ChevronRightIcon } from "../components/media/MediaDetailIcons";
import { fadeIn, fadeUp, textCascadeDelayed } from "../theme/motion";

// `fadeUp` / `fadeIn` viennent de `theme/motion` — la fiche avait ses propres
// copies, restées à 24 px de course quand la référence est passée à 10. La
// révélation du texte doit être la même d'une page à l'autre, sinon l'écart se
// remarque précisément là où l'on navigue le plus.

export function MediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  // Sur une fiche SÉRIE, on récupère l'épisode "à reprendre" pour le surligner
  // dans la liste (même traitement que l'épisode courant sur une fiche épisode).
  const { data: seriesWatchState } = useSeriesWatchState(item?.Type === "Series" ? item.Id : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  // Collection (BoxSet) : contenu navigable de la collection
  const { data: collectionItems } = useCollectionItems(item?.Type === "BoxSet" ? item.Id : undefined);

  // Origine de l'ouverture : le rectangle du visuel cliqué, capturé juste avant
  // la navigation.
  const [origin, setOrigin] = useState<DetailOrigin | null>(() => consumeDetailOrigin(itemId));

  /**
   * La page a-t-elle été ouverte PAR une transition ?
   *
   * C'est la clé du défaut d'ouverture. Le calque recouvre l'écran pendant que
   * cette page, dessous, joue sa PROPRE entrée — voile de page, cascade de
   * texte, fondu de l'affiche. Les deux ne peuvent pas être synchronisées : le
   * calque ne démarre son vol qu'une fois la requête revenue ET l'affiche
   * mesurée. Selon que l'item est en cache ou non, il s'efface avant ou après la
   * fin de la cascade — et quand c'est avant, on découvre le titre et l'affiche
   * à mi-opacité, invisibles sur un backdrop lumineux, puis l'entrée se termine
   * sous nos yeux. D'où un défaut intermittent, qui dépend du contenu.
   *
   * Une seule chorégraphie à la fois : quand le calque prend en charge
   * l'ouverture, le contenu qu'il découvre doit être PRÊT, pas en train de se
   * monter. Sans origine (rechargement, lien direct, retour), la cascade joue
   * normalement — c'est là qu'elle a du sens.
   *
   * `useRef` et non l'état : `origin` retombe à null dès que le calque a fini,
   * et l'entrée ne doit surtout pas se déclencher à ce moment-là.
   */
  const openedByTransition = useRef(origin !== null);

  // Relue à CHAQUE changement d'item, et pas seulement au montage. React Router
  // réutilise ce composant d'une fiche à l'autre — un initialiseur `useState` ne
  // s'y rejoue pas —, si bien que passer d'une fiche à une fiche similaire
  // n'animait rien du tout. La lecture est non destructive et rend le même objet
  // tant que rien n'a été recapturé : la rejouer est sans effet.
  useEffect(() => {
    const next = consumeDetailOrigin(itemId);
    setOrigin(next);
    setTarget(null);
    // Le composant étant réutilisé d'une fiche à l'autre, le régime d'entrée
    // doit suivre l'item courant : la fiche suivante peut très bien s'ouvrir
    // sans transition (lien direct) après une qui en avait une.
    openedByTransition.current = next !== null;
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
        <div className="flex h-screen items-center justify-center bg-surface-0">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-line-strong border-t-content-primary" />
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
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];

  return (
    <>
    {/* Voile de page neutralisé quand le calque ouvre la fiche : il déplace la
        page de 12 px et l'échelonne à 99,5 % SOUS le calque, mouvement que
        personne ne voit et qui n'a plus qu'à finir au mauvais moment. */}
    <PageTransition skip={openedByTransition.current}>
      <div className="min-h-screen bg-surface-0">
        <DetailHero backdropUrl={backdropUrl} item={item} />

        <motion.div
          className="-mt-48 relative z-10 px-4 md:px-12"
          // `initial={false}` quand le calque a ouvert la page : le contenu rend
          // son état FINAL d'emblée. Sinon la cascade se joue sous le calque,
          // invisible, et il ne lui reste plus qu'à se terminer au mauvais
          // moment — c'est le défaut d'ouverture.
          initial={openedByTransition.current ? false : "hidden"}
          animate="show"
          // Constante de module (cf. `theme/motion`), jamais un littéral en
          // ligne : un objet neuf à chaque rendu fait rejouer toute la cascade
          // par framer, et cette page se rend plusieurs fois — mesure du visuel,
          // arrivée des requêtes.
          variants={textCascadeDelayed}
        >
          <div className="flex flex-col gap-4 md:flex-row md:gap-8">
            <DetailPoster
              item={item}
              onMeasure={handleMeasure}
              instant={openedByTransition.current}
            />

            <div className="flex-1 pt-4">
              <motion.h1
                variants={fadeUp}
                className="text-display-3 font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)] line-clamp-2 break-words max-w-3xl md:text-display-2"
              >
                {item.Name}
              </motion.h1>
              {item.OriginalTitle && item.OriginalTitle !== item.Name && (
                <motion.p variants={fadeUp} className="mt-0.5 text-sm text-on-media-secondary">
                  {item.OriginalTitle}
                </motion.p>
              )}
              {isEpisode && item.SeriesName && item.SeriesId && (
                <motion.button
                  variants={fadeUp}
                  type="button"
                  onClick={() => navigate(`/media/${item.SeriesId}`)}
                  aria-label={t("common:goToSeries")}
                  title={t("common:goToSeries")}
                  className="group/series mt-1 inline-flex items-center gap-1.5 py-1 text-lg text-on-media-secondary transition-colors hover:text-on-media-primary"
                >
                  <span className="underline-offset-4 group-hover/series:underline">
                    {item.SeriesName} — S{item.ParentIndexNumber}E{item.IndexNumber}
                  </span>
                  <ChevronRightIcon />
                </motion.button>
              )}

              <DetailMetadata item={item} streams={streams} />
              <DetailOverview item={item} />
              <DetailActions item={item} />

              {streams.length > 0 && (
                <motion.div variants={fadeUp}>
                  <TechInfo streams={streams} />
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Collection (BoxSet) : contenu navigable — un BoxSet n'a ni lecture
            ni saisons, sa fiche restait vide. */}
        {item.Type === "BoxSet" && collectionItems && collectionItems.length > 0 && (
          <motion.div
            className="mt-10"
            variants={fadeIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <MediaRow
              title={t("common:collectionContent", { defaultValue: "Contenu de la collection" })}
              items={collectionItems}
            />
          </motion.div>
        )}

        {/* Extras AU-DESSUS de Saisons & Épisodes. Sur une fiche épisode, on
            passe la série parente pour afficher ses extras en repli. */}
        <div className="mt-10">
          <ExtrasSection item={item} seriesItem={isEpisode ? parentSeries : undefined} />
        </div>

        {episodeListSeriesId && (
          <motion.section
            className="mt-10"
            variants={fadeIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="row-gutter text-xl font-semibold text-content-primary">{t("common:seasonsEpisodes")}</h2>
            <EpisodeList
              seriesId={episodeListSeriesId}
              currentEpisodeId={highlightEpisodeId}
              initialSeasonId={highlightSeasonId}
            />
          </motion.section>
        )}

        {(item.People?.length || item.Studios?.length) && (
          <motion.section
            className="mt-8"
            variants={fadeIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <CastRow people={item.People ?? []} studios={item.Studios} />
          </motion.section>
        )}

        <LicenseAttribution item={item} />

        {similar && similar.length > 0 && (
          <motion.div
            className="mt-8 pb-16"
            variants={fadeIn}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <MediaRow title={t("common:similarTitles")} items={similar} />
          </motion.div>
        )}
      </div>
    </PageTransition>
    {openOverlay}
    </>
  );
}
