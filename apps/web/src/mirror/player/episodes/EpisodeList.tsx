import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useBatchWatchedToggle, useEpisodes, useSeasons } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { EpisodeRow } from "./EpisodeRow";
import { SHEET } from "./sheetColors";

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
 * l'app (et ses `SeasonPills`, `SeasonActionBar`, `EpisodeItems`) : les
 * pilules de saison (hauteur 36, sélection rose), « Marquer la saison vue »,
 * puis une ligne par épisode, 8 d'écart, marges 16, 640 au plus.
 */
export function EpisodeList({ seriesId, currentEpisodeId, initialSeasonId, scrollRef, onPlay }: Props) {
  const { data: seasons } = useSeasons(seriesId);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const activeSeason = selected ?? initialSeasonId ?? seasons?.[0]?.Id;

  return (
    <div style={{ marginTop: 24 }}>
      {seasons && seasons.length > 0 && (
        <div className="mirror-no-scrollbar flex flex-row overflow-x-auto" style={{ paddingInline: 16, gap: 8, marginBottom: 12 }}>
          {seasons.map((season) => {
            const active = season.Id === activeSeason;
            return (
              <button
                key={season.Id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(season.Id)}
                className="flex shrink-0 items-center justify-center whitespace-nowrap rounded-full [-webkit-tap-highlight-color:transparent]"
                style={{
                  minHeight: 36, paddingInline: 14, paddingBlock: 8,
                  backgroundColor: active ? SHEET.accentSoft : SHEET.fillSubtle,
                  border: `1px solid ${active ? SHEET.accentGlow : SHEET.borderSubtle}`,
                  color: active ? SHEET.accentText : SHEET.textTertiary,
                  fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: 0.1,
                }}
              >
                {season.Name}
              </button>
            );
          })}
        </div>
      )}
      {activeSeason && (
        <SeasonEpisodes
          seriesId={seriesId}
          seasonId={activeSeason}
          currentEpisodeId={currentEpisodeId}
          // Le ciblage ne vaut que pour la saison de l'épisode courant.
          scrollRef={selected === undefined ? scrollRef : undefined}
          onPlay={onPlay}
        />
      )}
    </div>
  );
}

function SeasonEpisodes({ seriesId, seasonId, currentEpisodeId, scrollRef, onPlay }: {
  seriesId: string;
  seasonId: string;
  currentEpisodeId?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onPlay: (ep: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const { data: episodes } = useEpisodes(seriesId, seasonId);
  const batchCtx = useMemo(() => ({ seriesId, seasonId }), [seriesId, seasonId]);
  const { markWatched, markUnwatched } = useBatchWatchedToggle(batchCtx);
  const allWatched = useMemo(() => !!episodes && episodes.every((ep) => ep.UserData?.Played), [episodes]);
  const busy = markWatched.isPending || markUnwatched.isPending;
  const currentRef = useRef<HTMLDivElement | null>(null);
  const didScroll = useRef(false);
  const hasCurrent = !!currentEpisodeId && !!episodes?.some((ep) => ep.Id === currentEpisodeId);

  // L'épisode courant s'amène à l'écran de lui-même, une fois par ouverture.
  useEffect(() => {
    const scroll = scrollRef?.current;
    const row = currentRef.current;
    if (!hasCurrent || didScroll.current || !scroll || !row) return;
    didScroll.current = true;
    const delta = row.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    scroll.scrollTop = Math.max(0, scroll.scrollTop + delta - 96);
  }, [hasCurrent, scrollRef]);

  if (!episodes || episodes.length === 0) return null;
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
