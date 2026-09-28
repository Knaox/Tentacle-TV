import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCollectionItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaCard } from "../../cards/MediaCard";
import { MediaRow } from "../../rows/MediaRow";
import { CONTENT_MAX_WIDTH } from "../../responsive";
import { CastRow } from "./CastRow";
import { EpisodeList } from "./EpisodeList";
import { ExtrasSection } from "./ExtrasSection";
import { LicenseAttribution } from "./LicenseAttribution";
import { DetailFacts } from "./DetailFacts";
import { SagaRow } from "./SagaRow";

interface Props {
  item: MediaItem;
  parentSeries?: MediaItem;
  similar?: MediaItem[];
  episodeListSeriesId?: string;
  highlightEpisodeId?: string;
  highlightSeasonId?: string;
}

/**
 * `DetailBody` de l'app : genres → synopsis → contenu de la collection →
 * casting et équipe → extras → saisons et épisodes → informations → licence →
 * saga du film → titres similaires. Le même sous le visuel (portrait) que dans
 * la colonne droite qui défile (iPad paysage).
 */
export const DetailBody = memo(function DetailBody({ item, parentSeries, similar, episodeListSeriesId, highlightEpisodeId, highlightSeasonId }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const isEpisode = item.Type === "Episode";
  const onPlay = useCallback((ep: MediaItem) => navigate(`/watch/${ep.Id}`), [navigate]);
  const { data: collectionItems } = useCollectionItems(item.Type === "BoxSet" ? item.Id : undefined);

  return (
    <div>
      {item.Genres && item.Genres.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5 px-4" style={{ maxWidth: CONTENT_MAX_WIDTH }}>
          {item.Genres.slice(0, 6).map((g) => (
            <span key={g} className="truncate rounded bg-fill-soft px-2 py-[3.5px] text-[10px] font-bold tracking-[0.3px] text-content-tertiary">
              {g}
            </span>
          ))}
        </div>
      )}

      {item.Overview && <Overview text={item.Overview} />}

      {/* Collection (BoxSet) : son contenu, navigable (cf. l'app). */}
      {collectionItems && collectionItems.length > 0 && (
        <MediaRow
          title={t("collectionContent")}
          data={collectionItems}
          keyOf={(c) => c.Id}
          renderItem={(c) => <MediaCard item={c} onPress={() => navigate(`/media/${c.Id}`)} />}
        />
      )}

      {item.People && item.People.length > 0 && <CastRow people={item.People} />}

      {/* Extras au-dessus de Saisons & Épisodes ; épisode : ceux de la série en repli. */}
      <ExtrasSection item={item} seriesItem={isEpisode ? parentSeries : undefined} />

      {episodeListSeriesId && (
        <>
          <h2 className="mb-1 mt-5 px-4 text-[18px] font-bold text-content-primary">{t("seasonsEpisodes")}</h2>
          <EpisodeList
            seriesId={episodeListSeriesId}
            currentEpisodeId={highlightEpisodeId}
            initialSeasonId={highlightSeasonId}
            onPlay={onPlay}
          />
        </>
      )}

      <DetailFacts item={item} />

      <LicenseAttribution item={item} />

      {/* La saga d'un film, comme sur le bureau : juste avant les similaires. */}
      {item.Type === "Movie" && <SagaRow item={item} />}

      {similar && similar.length > 0 && (
        <MediaRow
          title={t("recommendations")}
          data={similar}
          keyOf={(s) => s.Id}
          renderItem={(s) => <MediaCard item={s} onPress={() => navigate(`/media/${s.Id}`)} />}
        />
      )}
    </div>
  );
});

/**
 * Le synopsis : 15 / 22 en secondaire, 4 lignes, puis « Voir plus » (13
 * semi-gras violet clair, 8 au-dessus) seulement s'il a vraiment été coupé.
 */
function Overview({ text }: { text: string }) {
  const { t } = useTranslation("common");
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className="mt-4 px-4" style={{ maxWidth: CONTENT_MAX_WIDTH }}>
      <p ref={ref} className={`text-[15px] leading-[22px] tracking-[-0.075px] text-content-secondary ${expanded ? "" : "line-clamp-4"}`}>
        {text}
      </p>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[13px] font-semibold text-brand-light"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </div>
  );
}
