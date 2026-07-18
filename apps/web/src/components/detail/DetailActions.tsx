import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  useFavoriteForItem,
  useToggleWatchlistForItem,
  useWatchedToggle,
  useSeriesWatchState,
  useWatchlistSeriesIds,
  useFavoriteSeriesIds,
} from "@tentacle-tv/api-client";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { PlayIcon, HeartIcon, BookmarkIcon, CheckCircleIcon } from "../media/MediaDetailIcons";
import { TrailerButton } from "./TrailerButton";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { InviteUsersModal } from "../../watchTogether/InviteUsersModal";
import { useToast } from "../../contexts/ToastContext";

interface DetailActionsProps {
  item: MediaItem;
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

/**
 * Primary CTA cluster on the detail page: Play (white), Favorite, Watchlist,
 * Watched. Encapsulates all mutations + the resume label logic for series.
 */
export function DetailActions({ item }: DetailActionsProps) {
  const { t } = useTranslation("common");
  const { t: tWt } = useTranslation("watchTogether");
  const navigate = useNavigate();
  const { show } = useToast();
  const { isInGroup, isHost, actions: wtActions } = useWatchTogether();
  const [wtInviteOpen, setWtInviteOpen] = useState(false);
  const isSeries = item.Type === "Series";
  const isEpisode = item.Type === "Episode";
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);
  const { add: addFav, remove: removeFav } = useFavoriteForItem(item);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlistForItem(item);
  const { markWatched, markUnwatched } = useWatchedToggle(item.Id, {
    seriesId: item.SeriesId,
    seasonId: item.SeasonId,
    itemType: item.Type,
  });
  const watchlistSeries = useWatchlistSeriesIds();
  const favoriteSeries = useFavoriteSeriesIds();

  // Un épisode reflète l'état de sa série ; Movie/Series lisent UserData.
  const isFavorite = isEpisode ? favoriteSeries.has(item.SeriesId) : item.UserData?.IsFavorite === true;
  const isInWatchlist = isEpisode ? watchlistSeries.has(item.SeriesId) : item.UserData?.Likes === true;
  const isWatched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const hasResume = progress != null && progress > 0 && progress < 100;

  const handlePlay = () => {
    if (isSeries) {
      const epId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
      if (epId && epId !== item.Id) navigate(`/watch/${epId}`);
      return;
    }
    navigate(`/watch/${item.Id}`);
  };

  const playLabel = (() => {
    // BoxSet (collection) : conteneur sans MediaSources — pas de lecture.
    if (item.Type === "BoxSet") return null;
    if (isSeries) {
      if (!watchState || watchState.type === "completed") return null;
      const ep = watchState.episode;
      const epLabel = formatEpisodeCode(ep.ParentIndexNumber, ep.IndexNumber);
      if (watchState.type === "continue") return `${t("common:resume")} ${epLabel}`;
      if (watchState.type === "next") return `${t("common:play")} ${epLabel}`;
      return t("common:play");
    }
    return hasResume ? t("common:resume") : t("common:play");
  })();

  return (
    <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3">
      {playLabel && (
        <motion.button
          type="button"
          onClick={handlePlay}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2.5 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition-colors duration-150 hover:bg-white/85"
        >
          <PlayIcon /> {playLabel}
        </motion.button>
      )}

      <TrailerButton item={item} />

      <CircleAction
        active={isFavorite}
        onClick={() => (isFavorite ? removeFav.mutate() : addFav.mutate())}
        label={isFavorite ? t("common:removeFromFavorites") : t("common:addToFavorites")}
        icon={<HeartIcon filled={isFavorite} />}
      />
      <CircleAction
        active={isInWatchlist}
        onClick={() => (isInWatchlist ? removeWatchlist.mutate() : addWatchlist.mutate())}
        label={isInWatchlist ? t("common:removeFromMyList") : t("common:addToMyList")}
        icon={<BookmarkIcon filled={isInWatchlist} />}
      />
      <CircleAction
        active={isWatched}
        onClick={() => (isWatched ? markUnwatched.mutate() : markWatched.mutate())}
        label={isWatched ? "Marquer comme non vu" : "Marquer comme vu"}
        icon={<CheckCircleIcon filled={isWatched} />}
      />

      {/* Watch Together : crée le groupe (média en contexte) puis invite ;
          en groupe, l'hôte peut inviter d'ici. Lancer la lecture = bouton
          Lire normal (le moteur de sync propage le média au groupe). */}
      {item.Type !== "BoxSet" && (!isInGroup || isHost) && (
        <CircleAction
          active={isInGroup}
          onClick={async () => {
            if (isInGroup) { setWtInviteOpen(true); return; }
            try {
              await wtActions.create(item.Id);
              setWtInviteOpen(true);
            } catch {
              show("error", tWt("alreadyInGroup"));
            }
          }}
          label={isInGroup ? tWt("invite") : tWt("watchTogetherAction")}
          icon={<UsersIcon />}
        />
      )}

      {hasResume && !isSeries && (
        <span className="text-sm text-white/50">
          {t("common:percentWatched", { percent: Math.round(progress!) })}
        </span>
      )}

      {wtInviteOpen && <InviteUsersModal onClose={() => setWtInviteOpen(false)} />}
    </motion.div>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function CircleAction({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all hover:bg-white/15 ${
        active
          ? "border-white bg-white/15 text-white"
          : "border-white/30 text-white/85"
      }`}
    >
      {icon}
    </button>
  );
}
