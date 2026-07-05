import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSetLibraryPreference } from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";

/**
 * « Appliquer à cette série » : enregistre les pistes audio/sous-titres
 * COURANTES comme préférence de langue pour la série de l'épisode en cours.
 * S'appuie sur l'infra existante des préférences par bibliothèque : la
 * résolution backend (/preferences/resolve) parcourt les candidats dans
 * l'ordre [saison, série, …ancêtres] et prend la PREMIÈRE préférence trouvée —
 * une préférence stockée avec libraryId = seriesId override donc naturellement
 * celle de la bibliothèque, sans aucun changement serveur.
 *
 * Renvoie undefined hors épisode (le bouton ne s'affiche pas).
 */
export function useApplyToSeries({
  item,
  streams,
  audioIndex,
  subtitleIndex,
}: {
  item: MediaItem | undefined;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex: number | null;
}): (() => void) | undefined {
  const { t } = useTranslation("player");
  const { show } = useToast();
  const setPref = useSetLibraryPreference();

  const seriesId = item?.Type === "Episode" ? item.SeriesId : undefined;

  const apply = useCallback(() => {
    if (!seriesId) return;
    const audioLang = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex)?.Language ?? null;
    const subtitleLang = subtitleIndex !== null
      ? streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Language ?? null
      : null;
    setPref.mutate(
      {
        libraryId: seriesId,
        audioLang,
        subtitleLang,
        subtitleMode: subtitleIndex === null ? "none" : "always",
      },
      {
        onSuccess: () => show("success", t("appliedToSeries")),
        onError: () => show("error", t("applyToSeriesFailed")),
      },
    );
  }, [seriesId, streams, audioIndex, subtitleIndex, setPref, show, t]);

  return seriesId ? apply : undefined;
}
