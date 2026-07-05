import { useCallback, useEffect, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteLibraryPreference, useLibraryPreference, useSetLibraryPreference,
} from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";

/** Contrôle de la case « Appliquer à cette série » du panneau pistes. */
export interface ApplyToSeriesControl {
  /** Une préférence de langues existe pour la série (case cochée). */
  checked: boolean;
  /** Mutation en cours — case momentanément inerte. */
  pending: boolean;
  toggle: (checked: boolean) => void;
}

/**
 * « Appliquer à cette série » : case à cocher qui enregistre les pistes
 * audio/sous-titres COURANTES comme préférence de langue pour la série de
 * l'épisode en cours (et la retire quand on décoche). Tant que la case est
 * cochée, un changement de piste fait par l'utilisateur met la préférence à
 * jour. S'appuie sur l'infra des préférences par bibliothèque : la résolution
 * backend (/preferences/resolve) parcourt [saison, série, …ancêtres] et prend
 * la PREMIÈRE préférence trouvée — une préférence stockée avec
 * libraryId = seriesId override donc naturellement celle de la bibliothèque.
 *
 * Renvoie undefined hors épisode (la case ne s'affiche pas).
 */
export function useApplyToSeries({
  item,
  streams,
  audioIndex,
  subtitleIndex,
  audioOverrideRef,
  subtitleOverrideRef,
}: {
  item: MediaItem | undefined;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex: number | null;
  /** L'utilisateur a explicitement changé de piste pendant CETTE lecture —
   *  gate de la resync auto (un simple défaut de piste au montage ne doit
   *  jamais écraser la préférence enregistrée). */
  audioOverrideRef: MutableRefObject<boolean>;
  subtitleOverrideRef: MutableRefObject<boolean>;
}): ApplyToSeriesControl | undefined {
  const { t } = useTranslation("player");
  const { show } = useToast();
  const setPref = useSetLibraryPreference();
  const delPref = useDeleteLibraryPreference();

  const seriesId = item?.Type === "Episode" ? item.SeriesId : undefined;
  // 404 = pas de préférence (query en erreur, retry désactivé) → non cochée.
  const pref = useLibraryPreference(seriesId ?? undefined);
  const checked = !!pref.data;

  const currentLangs = useCallback(() => {
    const audioLang = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex)?.Language ?? null;
    const subtitleLang = subtitleIndex !== null
      ? streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Language ?? null
      : null;
    return {
      audioLang,
      subtitleLang,
      subtitleMode: (subtitleIndex === null ? "none" : "always") as "none" | "always",
    };
  }, [streams, audioIndex, subtitleIndex]);

  const toggle = useCallback((next: boolean) => {
    if (!seriesId) return;
    if (next) {
      setPref.mutate(
        { libraryId: seriesId, ...currentLangs() },
        {
          onSuccess: () => show("success", t("appliedToSeries")),
          onError: () => show("error", t("applyToSeriesFailed")),
        },
      );
    } else {
      delPref.mutate(seriesId, {
        onSuccess: () => show("info", t("seriesPreferenceCleared")),
        // 404 = déjà absente : l'état visé est atteint, pas d'erreur à montrer.
        onError: () => show("info", t("seriesPreferenceCleared")),
      });
    }
  }, [seriesId, currentLangs, setPref, delPref, show, t]);

  // Case cochée + changement de piste PAR L'UTILISATEUR → la préférence suit
  // (mise à jour silencieuse). Sans action utilisateur (overrides), on ne
  // touche à rien : les pistes du montage peuvent différer de la préférence
  // (piste absente du média) sans que ce soit un choix.
  useEffect(() => {
    if (!seriesId || !pref.data || setPref.isPending) return;
    if (!audioOverrideRef.current && !subtitleOverrideRef.current) return;
    const cur = currentLangs();
    const saved = pref.data;
    if (
      saved.audioLang === cur.audioLang
      && saved.subtitleLang === cur.subtitleLang
      && saved.subtitleMode === cur.subtitleMode
    ) return;
    setPref.mutate({ libraryId: seriesId, ...cur });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, pref.data, audioIndex, subtitleIndex]);

  if (!seriesId) return undefined;
  return { checked, pending: setPref.isPending || delPref.isPending, toggle };
}
