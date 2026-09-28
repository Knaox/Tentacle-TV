import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { ViewingStatsSignals, ViewingStatsTaste, ViewingStatsTasteTitle } from "@tentacle-tv/shared";
import { RECO_REFINE_PATH } from "../../lib/recoSections";
import { useRecoNavigation } from "../../lib/recoNavigation";
import { StatsSection } from "./StatsSection";
import { TitleRail, type RailTitle } from "./TitleRail";
import { useStatsFormat, type StatsFormat } from "./useStatsFormat";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w342";
const SIGNALS: Array<keyof Omit<ViewingStatsSignals, "ratingAverage">> = [
  "ratings", "superlikes", "likes", "dislikes", "likedPeople", "favorites",
];

function reasonText(f: StatsFormat, title: ViewingStatsTasteTitle): string {
  return title.reasons
    .slice(0, 2)
    .map((r) => (r === "rating" && title.rating !== null ? f.t("reason_rating", { rating: f.number(title.rating, title.rating % 1 ? 1 : 0) }) : f.t(`reason_${r}`)))
    .join(" · ");
}

/**
 * « Ce que vous aimez » — le profil du moteur de recommandations, montré tel
 * quel : les titres qui pèsent le plus dans le goût (et pourquoi : coup de
 * cœur, note, série suivie…), puis les avis donnés. Un titre de la
 * bibliothèque ouvre sa fiche ; hors bibliothèque, la fiche catalogue de Vigie
 * quand l'extension est là. « Affiner mes goûts » mène à la pile de swipe.
 */
export const TasteSection = memo(function TasteSection({ taste }: { taste: ViewingStatsTaste }) {
  const f = useStatsFormat();
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { open, canOpen } = useRecoNavigation();

  const rail: RailTitle[] = useMemo(
    () =>
      taste.loved.map((l) => {
        const nav = { jellyfinItemId: l.jellyfinId, mediaType: l.mediaType, tmdbId: l.tmdbId };
        return {
          key: l.key,
          href: l.jellyfinId ? `/media/${l.jellyfinId}` : null,
          onOpen: !l.jellyfinId && l.tmdbId > 0 && canOpen(nav) ? () => open(nav) : undefined,
          title: l.title,
          caption: reasonText(f, l),
          imageUrl: l.jellyfinId
            ? client.getImageUrl(l.jellyfinId, "Primary", { height: 360, quality: 85 })
            : l.posterPath ? `${TMDB_POSTER}${l.posterPath}` : "",
        };
      }),
    [taste.loved, f, client, open, canOpen]
  );

  const signals = SIGNALS.filter((key) => taste.signals[key] > 0);
  const refine = (
    <button
      type="button"
      onClick={() => navigate(RECO_REFINE_PATH)}
      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[color:var(--surface-2)] px-4 text-sm font-semibold text-content-secondary ring-1 ring-line-strong transition-colors duration-150 hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    >
      <SlidersHorizontal size={15} aria-hidden />
      {f.t("tasteRefine")}
    </button>
  );

  if (!taste.available || taste.loved.length === 0) {
    return (
      <StatsSection title={f.t("tasteTitle")} trailing={refine}>
        <p className="text-sm text-content-tertiary">{f.t("tasteUnavailable")}</p>
      </StatsSection>
    );
  }

  return (
    <StatsSection title={f.t("tasteTitle")} hint={f.t("tasteHint")} trailing={refine} bare>
      <TitleRail items={rail} ariaLabel={f.t("tasteTitle")} />
      {(signals.length > 0 || taste.animeShare >= 0.05) && (
        <div className="mt-2">
          <h3 className="mb-2 text-sm font-semibold text-content-secondary">{f.t("signalsTitle")}</h3>
          <ul className="flex flex-wrap gap-2">
            {signals.map((key) => (
              <li key={key} className="rounded-full bg-[color:var(--surface-1)] px-3 py-1.5 text-sm ring-1 ring-line-subtle">
                <span className="font-semibold text-content-primary">{f.number(taste.signals[key])}</span>{" "}
                <span className="text-content-secondary">{f.t(`signal_${key}`, { count: taste.signals[key] })}</span>
                {key === "ratings" && taste.signals.ratingAverage !== null && (
                  <span className="text-content-tertiary"> · {f.t("signalAverage", { average: f.number(taste.signals.ratingAverage, 1) })}</span>
                )}
              </li>
            ))}
            {taste.animeShare >= 0.05 && (
              <li className="rounded-full bg-[color:var(--surface-1)] px-3 py-1.5 text-sm text-content-secondary ring-1 ring-line-subtle">
                {f.t("tasteAnime", { share: f.percent(taste.animeShare) })}
              </li>
            )}
          </ul>
        </div>
      )}
    </StatsSection>
  );
});
