import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useMediaItem, useSeriesWatchState, useSimilarItems } from "@tentacle-tv/api-client";
import { detailGallery, galleryIndexOf } from "@tentacle-tv/shared";
import { DetailImageViewer } from "../../../components/detail/DetailImageViewer";
import { CardSheetProvider } from "../../cards/CardSheetProvider";
import { useViewport } from "../../useFormFactor";
import { DETAIL_MAX_WIDTH } from "../../responsive";
import { BackButton } from "./BackButton";
import { DetailBody } from "./DetailBody";
import { DetailHeader } from "./DetailHeader";
import { DetailSkeleton } from "./DetailSkeleton";
import { StageBlock } from "./StageBlock";
import { DetailTopBar, TOP_INSET } from "./DetailTopBar";
import { detailGeometry, TWO_COL_LEFT_WIDTH, TWO_COL_MAX_WIDTH } from "./detailMetrics";
import { useDetailScroll } from "./useDetailScroll";
import "../../mirror.css";
import "./detail.css";

/** `spacing.xxxl + 40` : le pied de page de la fiche de l'app. */
const BOTTOM_PAD = "calc(72px + env(safe-area-inset-bottom))";

/**
 * La fiche média du miroir (`/media/:itemId`) — `MediaDetailScreen` de l'app.
 *
 * Hors de la coquille, comme l'écran empilé de l'app : ni en-tête ni barre
 * d'onglets ; l'écran gère ses zones sûres et son retour. Une clé par titre :
 * passer d'une fiche à une similaire remonte l'écran en haut et rejoue la
 * cascade d'entrée, comme une nouvelle fiche poussée dans la pile.
 */
export function MirrorMediaDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  if (!itemId) return null;
  // L'hôte de la feuille d'appui long des affiches (collection, similaires) :
  // hors de la clé, il survit au passage d'une fiche à une autre.
  return (
    <CardSheetProvider>
      <DetailScreen key={itemId} itemId={itemId} />
    </CardSheetProvider>
  );
}

function DetailScreen({ itemId }: { itemId: string }) {
  const { width, height, formFactor, landscape } = useViewport();
  const geo = detailGeometry(width, height, formFactor === "tablet", landscape);
  const client = useJellyfinClient();
  const { t } = useTranslation("media");
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data: item } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  // Séries : l'épisode à regarder (à suivre, à reprendre, premier).
  const { data: seriesWatchState } = useSeriesWatchState(item?.Type === "Series" ? item.Id : undefined);

  useDetailScroll(scrollerRef, hostRef, geo.revealAt, !!item && !geo.twoCol);

  // Vue « image plein écran » : la même que le bureau (glisser au doigt).
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const gallery = useMemo(() => (item ? detailGallery(item) : []), [item]);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

  if (!item) return <DetailSkeleton />;

  const backdrop = client.getImageUrl(item.ParentBackdropItemId ?? item.Id, "Backdrop", { width: 1200, quality: 85 });
  const isSeries = item.Type === "Series";
  const episodeListSeriesId = isSeries ? item.Id : isEpisode ? item.SeriesId : undefined;
  const seriesResumeEp = isSeries && seriesWatchState && seriesWatchState.type !== "completed" ? seriesWatchState.episode : undefined;
  const highlightEpisodeId = isEpisode ? item.Id : seriesResumeEp?.Id;
  const highlightSeasonId = isEpisode ? item.SeasonId : seriesResumeEp?.SeasonId;

  const openImages = gallery.length > 0 ? () => setViewerIndex(0) : undefined;
  const openPoster = gallery.length > 0 ? () => setViewerIndex(galleryIndexOf(gallery, isEpisode ? "still" : "poster")) : undefined;
  const viewer = (
    <DetailImageViewer title={item.Name} gallery={gallery} index={viewerIndex} onIndexChange={setViewerIndex} onClose={closeViewer} />
  );
  const header = (
    <DetailHeader
      item={item}
      geo={geo}
      seriesWatchState={seriesWatchState}
      onOpenPoster={openPoster}
    />
  );
  const body = (
    <div className="mirror-detail-in-content">
      <DetailBody
        item={item}
        parentSeries={parentSeries}
        similar={similar}
        episodeListSeriesId={episodeListSeriesId}
        highlightEpisodeId={highlightEpisodeId}
        highlightSeasonId={highlightSeasonId}
      />
    </div>
  );

  // iPad paysage : colonne gauche figée de 380 + corps qui défile, 1180 au
  // plus, visuel FIXE sous un voile `surface.s0Tint` à 0,86.
  if (geo.twoCol) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-surface-0">
        <img src={backdrop} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "color-mix(in srgb, var(--surface-0-tint) 86%, transparent)" }} />
        {/* Le retour ne défile pas : fixe, plus grand et bordé sur iPad. */}
        <div className="absolute left-4 z-10" style={{ top: `calc(${TOP_INSET} + 8px)` }}>
          <BackButton large />
        </div>
        {viewer}
        <div
          className="relative mx-auto flex h-full w-full"
          style={{ maxWidth: TWO_COL_MAX_WIDTH, paddingTop: `calc(${TOP_INSET} + 8px)` }}
        >
          {/* Le retour est fixe en haut à gauche : la colonne commence sous lui
              (l'affiche passait dessous). */}
          <div className="mirror-detail-rail mirror-no-scrollbar shrink-0 overflow-y-auto pb-6 pt-14" style={{ width: TWO_COL_LEFT_WIDTH }}>{header}</div>
          <div
            className="mirror-no-scrollbar min-w-0 flex-1 overflow-y-auto overscroll-y-contain pt-2"
            style={{ paddingBottom: BOTTOM_PAD }}
          >
            {body}
          </div>
        </div>
      </div>
    );
  }

  // Portrait (téléphone, iPad portrait) : une colonne, visuel plein cadre avec
  // parallaxe ; seul le contenu est centré sous 920.
  return (
    <div ref={hostRef} className="fixed inset-0 bg-surface-0" style={{ ["--bh" as string]: geo.backdropH } as CSSProperties}>
      <div
        ref={scrollerRef}
        className="mirror-no-scrollbar h-full overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{ paddingBottom: BOTTOM_PAD }}
      >
        {/* La SCÈNE : le décor sur 70 % de l'écran, le bloc titre posé dans son
            bas — il ne quitte jamais l'image, ce qui garde le texte `on-media`
            lisible dans les deux thèmes. Toucher le décor ouvre les images. */}
        <section className="relative flex w-full flex-col justify-end overflow-hidden" style={{ minHeight: geo.backdropH }}>
          <button
            type="button"
            onClick={openImages}
            disabled={!openImages}
            aria-label={t("detailViewImages")}
            className="absolute inset-0 block cursor-zoom-in disabled:cursor-default"
          >
            <span className="mirror-detail-parallax absolute inset-0 block">
              <img src={backdrop} alt="" decoding="async" draggable={false} className="mirror-detail-kenburns h-full w-full object-cover" style={{ objectPosition: "center 30%" }} />
            </span>
          </button>
          {/* Voile haut « soft » vers le fond de page, 120 + zone sûre. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: "calc(120px + env(safe-area-inset-top))",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 85%, transparent) 0%, color-mix(in srgb, var(--surface-0) 40%, transparent) 35%, color-mix(in srgb, var(--surface-0) 10%, transparent) 75%, transparent 100%)",
            }}
          />
          {/* Fondu bas (rampe « detail ») puis l'assise du bloc titre : une
              ellipse sombre STATIQUE, centrée sous le texte. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "80%", background: "var(--detail-scrim-bottom)" }} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(95% 48% at 50% 100%, rgba(var(--scrim-media-rgb), 0.62) 0%, rgba(var(--scrim-media-rgb), 0.3) 50%, transparent 85%)" }}
          />
          <div
            className="pointer-events-none relative mx-auto w-full px-5 pb-2 [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
            style={{ maxWidth: DETAIL_MAX_WIDTH, paddingTop: `calc(${TOP_INSET} + 64px)` }}
          >
            <StageBlock item={item} align="center" logoMaxW={geo.logoMaxW} logoMaxH={geo.logoMaxH} />
          </div>
        </section>
        <div className="mx-auto w-full" style={{ maxWidth: DETAIL_MAX_WIDTH }}>
          {header}
          {body}
        </div>
      </div>
      <DetailTopBar title={item.Name ?? ""} onOpenImages={openImages} />
      {viewer}
    </div>
  );
}
