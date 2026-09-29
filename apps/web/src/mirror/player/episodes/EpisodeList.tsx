import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useBatchWatchedToggle, useSeasonBrowser } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { EpisodeRow } from "./EpisodeRow";
import { SHEET } from "./sheetColors";
import { SeasonTabs } from "../../../components/episodes/SeasonTabs";

interface Props {
  seriesId: string;
  currentEpisodeId?: string;
  initialSeasonId?: string;
  /** Le conteneur qui défile : la ligne de l'épisode courant s'y amène seule. */
  scrollRef: RefObject<HTMLDivElement | null>;
  onPlay: (ep: MediaItem) => void;
}

/**
 * La liste des épisodes du sélecteur du lecteur — `MobileEpisodeList` de
 * l'app (et ses `SeasonActionBar`, `EpisodeItems`) : la bande des saisons
 * (en valeurs sombres, la feuille est noire dans les deux thèmes), « Marquer
 * la saison vue », puis une ligne par épisode, 8 d'écart, marges 16, 640 au
 * plus.
 */
export function EpisodeList({ seriesId, currentEpisodeId, initialSeasonId, scrollRef, onPlay }: Props) {
  // Liste légère seulement : ces lignes n'affichent ni qualité ni langues.
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: initialSeasonId,
    currentEpisodeSeasonId: initialSeasonId,
    sources: false,
  });
  const { seasons, selectedSeasonId, episodes } = browser;

  return (
    <div style={{ marginTop: 24 }}>
      {seasons && seasons.length > 0 && (
        <SeasonTabs
          seasons={seasons}
          selectedId={selectedSeasonId}
          markedId={browser.markedSeasonId}
          onSelect={browser.select}
          onIntent={browser.prefetch}
          tone="dark"
          className="mb-3"
          stripClassName="px-4"
        />
      )}
      {selectedSeasonId && episodes && episodes.length > 0 && (
        <SeasonEpisodes
          seriesId={seriesId}
          seasonId={selectedSeasonId}
          episodes={episodes}
          currentEpisodeId={currentEpisodeId}
          // Le ciblage ne vaut que pour la saison de l'épisode courant.
          scrollRef={selectedSeasonId === initialSeasonId ? scrollRef : undefined}
          onPlay={onPlay}
        />
      )}
    </div>
  );
}

function SeasonEpisodes({ seriesId, seasonId, episodes, currentEpisodeId, scrollRef, onPlay }: {
  seriesId: string;
  seasonId: string;
  episodes: MediaItem[];
  currentEpisodeId?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onPlay: (ep: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const batchCtx = useMemo(() => ({ seriesId, seasonId }), [seriesId, seasonId]);
  const { markWatched, markUnwatched } = useBatchWatchedToggle(batchCtx);
  const allWatched = useMemo(() => episodes.every((ep) => ep.UserData?.Played), [episodes]);
  const busy = markWatched.isPending || markUnwatched.isPending;
  const currentRef = useRef<HTMLDivElement | null>(null);
  const didScroll = useRef(false);
  const hasCurrent = !!currentEpisodeId && episodes.some((ep) => ep.Id === currentEpisodeId);

  // L'épisode courant s'amène à l'écran de lui-même, une fois par ouverture.
  useEffect(() => {
    const scroll = scrollRef?.current;
    const row = currentRef.current;
    if (!hasCurrent || didScroll.current || !scroll || !row) return;
    didScroll.current = true;
    const delta = row.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    scroll.scrollTop = Math.max(0, scroll.scrollTop + delta - 96);
  }, [hasCurrent, scrollRef]);

  const ids = episodes.map((ep) => ep.Id);

  return (
    <div className="w-full" style={{ maxWidth: 640 }}>
      <div className="flex flex-row items-center" style={{ gap: 8, marginInline: 16, marginBottom: 10 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => (allWatched ? markUnwatched.mutate(ids) : markWatched.mutate(ids))}
          className="flex flex-row items-center [-webkit-tap-highlight-color:transparent]"
          style={{ gap: 6, paddingInline: 12, paddingBlock: 8, borderRadius: 8, backgroundColor: SHEET.fillSubtle, opacity: busy ? 0.4 : 1 }}
        >
          {allWatched ? <EyeOff size={14} color={SHEET.textTertiary} /> : <Eye size={14} color={SHEET.textTertiary} />}
          <span style={{ color: SHEET.textTertiary, fontSize: 12, fontWeight: 600 }}>
            {allWatched ? t("markSeasonUnwatched") : t("markSeasonWatched")}
          </span>
        </button>
      </div>
      <div className="flex flex-col" style={{ paddingInline: 16, gap: 8 }}>
        {episodes.map((ep) => {
          const isCurrent = ep.Id === currentEpisodeId;
          return (
            <div key={ep.Id} ref={isCurrent ? currentRef : undefined}>
              <EpisodeRow ep={ep} seriesId={seriesId} seasonId={seasonId} isCurrent={isCurrent} onPlay={onPlay} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
