import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookmarkSimpleIcon as Bookmark } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CompassIcon as Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import type { WatchStageFilter } from "@tentacle-tv/api-client";
import { CollectionEmpty, CollectionNarrowEmpty } from "../collection/CollectionStates";

/**
 * Liste VIDE — pas filtrée à zéro, vide. Elle dit ce que la page promet et
 * donne deux chemins pour la remplir, dans le cadre des états vides de la
 * Bibliothèque.
 */
export const WatchlistEmpty = memo(function WatchlistEmpty() {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  return (
    <CollectionEmpty
      icon={Bookmark}
      title={tc("emptyWatchlist")}
      body={t("emptyBody")}
      primary={{ label: t("emptyExplore"), icon: Compass, onClick: () => navigate("/") }}
      secondary={{ label: t("emptySearch"), icon: Search, onClick: () => navigate("/search") }}
    />
  );
});

const STAGE_EMPTY: Record<Exclude<WatchStageFilter, "all">, string> = {
  new: "stageEmptyNew",
  inProgress: "stageEmptyInProgress",
  watched: "stageEmptyWatched",
};

/** Une étape sans titre : on le dit, et on rend tout d'un geste. */
export const WatchlistStageEmpty = memo(function WatchlistStageEmpty({
  stage, onShowAll,
}: {
  stage: Exclude<WatchStageFilter, "all">;
  onShowAll: () => void;
}) {
  const { t } = useTranslation("watchlist");
  return <CollectionNarrowEmpty message={t(STAGE_EMPTY[stage])} actionLabel={t("showAll")} onAction={onShowAll} />;
});
