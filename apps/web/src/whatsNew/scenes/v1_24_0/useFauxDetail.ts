import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { splitMinutes } from "@tentacle-tv/shared";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import type { FauxDetailData } from "./FauxDetailStage";

/** Avancement de repli, quand le titre du bandeau n'est pas entamé : la scène montre une reprise. */
const SCENE_PROGRESS = 0.4;

/**
 * La fiche mise en scène : le titre du bandeau, avec sa vraie fiche quand elle
 * est là (logo, note, durée) — sinon son décor et son nom seuls. Il est
 * « dans ma liste » : c'est l'état que la capsule et la note montrent ensemble.
 */
export function useFauxDetail(): FauxDetailData & { gallery: string[] } {
  const { t } = useTranslation(["common", "media"]);
  const media = useSceneMedia();
  return useMemo(() => {
    const detail = media.detail;
    const fallback = posterAt(media, 0);
    const progress = detail?.progress ?? SCENE_PROGRESS;
    let remaining: string | null = null;
    if (detail?.type === "Movie" && detail.runtimeMinutes) {
      const { hours, minutes } = splitMinutes(Math.round(detail.runtimeMinutes * (1 - progress)));
      remaining = hours > 0
        ? t("media:detailRemainingHours", { hours, minutes: String(minutes).padStart(2, "0") })
        : t("media:detailRemainingMinutes", { count: minutes });
    }
    const backdropUrl = detail?.gallery[0] ?? media.backdrop?.url ?? fallback?.backdropUrl ?? null;
    const gallery = detail && detail.gallery.length > 0 ? detail.gallery : backdropUrl ? [backdropUrl] : [];
    return {
      backdropUrl,
      gallery,
      title: detail?.title ?? media.backdrop?.title ?? fallback?.title ?? "",
      logoUrl: detail?.logoUrl ?? null,
      kicker: t(detail?.type === "Series" ? "media:kindSeries" : "media:kindMovie"),
      rating: detail?.rating ?? fallback?.rating ?? null,
      statuses: ["watchlist"],
      play: { label: t("common:resume"), remaining, progress },
    };
  }, [media, t]);
}
