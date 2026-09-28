import { memo, useMemo } from "react";
import { useJellyfinClient, type JellyfinClient } from "@tentacle-tv/api-client";
import { titleReasons, type ViewingStats, type ViewingStatsTitle } from "@tentacle-tv/shared";
import { PeopleRail } from "./PeopleRail";
import { reasonChips } from "./ReasonChips";
import { StatsSection } from "./StatsSection";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat } from "./useStatsFormat";

export function posterOf(client: JellyfinClient, title: ViewingStatsTitle, height = 360): string {
  return client.getImageUrl(title.id, "Primary", {
    height,
    quality: 85,
    ...(title.primaryTag ? { tag: title.primaryTag } : {}),
  });
}

/** Vos séries — les plus regardées de la période, au temps passé ; le rang en pastille. */
export const SeriesRail = memo(function SeriesRail({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const client = useJellyfinClient();
  const items: RailTitle[] = useMemo(
    () =>
      stats.topSeries.map((s) => ({
        key: s.id,
        href: `/media/${s.id}`,
        title: s.name,
        caption: [s.episodes > 0 ? f.t("seriesEpisodes", { count: s.episodes }) : null, s.seconds >= 60 ? f.duration(s.seconds) : null]
          .filter(Boolean)
          .join(" · "),
        chips: reasonChips(f, titleReasons(s)),
        imageUrl: posterOf(client, s),
      })),
    [stats.topSeries, f, client]
  );
  if (items.length === 0) return null;
  return (
    <StatsSection title={f.t("seriesTitle")} hint={f.t("seriesHint")} bare>
      <TitleRail items={items} ariaLabel={f.t("seriesTitle")} firstRank={1} />
    </StatsSection>
  );
});

/**
 * Vos têtes d'affiche — classées au nombre de TITRES où on les retrouve (une
 * série compte pour un), puis au temps passé ; la réalisation et la création
 * ensuite.
 */
export const PeopleSection = memo(function PeopleSection({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const { actors, directors } = stats.people;
  if (actors.length === 0 && directors.length === 0) return null;
  return (
    <StatsSection title={f.t("peopleTitle")} hint={f.t("peopleHint")} bare>
      <div className="flex flex-col gap-5">
        {actors.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-secondary">{f.t("actorsTitle")}</h3>
            <PeopleRail people={actors} ariaLabel={f.t("actorsTitle")} />
          </div>
        )}
        {directors.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-secondary">{f.t("directorsTitle")}</h3>
            <PeopleRail people={directors} ariaLabel={f.t("directorsTitle")} />
          </div>
        )}
      </div>
    </StatsSection>
  );
});
