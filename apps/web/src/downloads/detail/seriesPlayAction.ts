import { formatEpisodeCode, resumeState } from "@tentacle-tv/shared";
import { isInProgress, localUserData } from "@tentacle-tv/offline-core";
import type { DownloadEntry } from "../api";
import { remainingLabel } from "../../components/detail/DetailPlayButton";
import type { OfflinePlayAction } from "./OfflineStageActions";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Le bouton Lecture d'une série gardée, avec les mots de la fiche en ligne :
 * « Lecture » tout court pour une série jamais commencée ici, « Reprendre
 * S1 · E3 » dès qu'on l'a entamée — avec, pour un épisode commencé, ce qu'il
 * en reste et l'anneau d'avancement. Série vue en entier : on la relance
 * depuis son premier épisode gardé.
 */
export function seriesPlayAction(
  t: Translate,
  episodes: readonly DownloadEntry[],
  target: DownloadEntry | null,
): OfflinePlayAction | null {
  if (target === null) return null;
  const allPlayed = episodes.length > 0 && episodes.every((episode) => episode.played);
  const started = episodes.some((episode) => episode.played || isInProgress(episode));
  const resume = resumeState({
    Type: "Episode",
    RunTimeTicks: target.runtimeTicks ?? undefined,
    UserData: localUserData(target),
  });
  const code = target.parentIndexNumber != null && target.indexNumber != null
    ? formatEpisodeCode(target.parentIndexNumber, target.indexNumber)
    : "";
  const verb = started && !allPlayed ? t("common:resume") : t("common:play");
  const label = started && code ? `${verb} ${code}` : verb;
  return {
    label,
    remaining: resume?.remainingMinutes != null ? remainingLabel(resume.remainingMinutes, t) : null,
    progress: resume?.progress ?? null,
    itemId: target.itemId,
    name: target.title ?? "",
  };
}
