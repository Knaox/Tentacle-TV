import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteLibraryPreference, useLibraryPreference, useSetLibraryPreference, useUserId,
} from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";
import { queuePendingPref } from "../offline/pendingPrefs";
import { mirrorSeriesPref, seriesPrefFor } from "../offline/seriesTrackPref";
import { useOfflineMode } from "../offline/useOfflineMode";
import { sameTrackChoice, trackChoiceOf, type TrackChoice } from "./trackChoice";
import { seriesIdOf } from "./trackPrefScope";

/** Contrôle de la case « Appliquer à cette série » du panneau pistes. */
export interface ApplyToSeriesControl {
  /** Une préférence de langues existe pour la série (case cochée). */
  checked: boolean;
  /** Mutation en cours — case momentanément inerte. */
  pending: boolean;
  toggle: (checked: boolean) => void;
  /**
   * CE QUI est gardé, pour le dire en toutes lettres : la préférence enregistrée quand la case
   * est cochée, sinon ce que les pistes en cours enregistreraient. Des langues et un mode,
   * jamais des index. Facultatif : un appelant qui ne le donne pas garde une phrase générale.
   */
  choice?: TrackChoice;
}

/**
 * « Appliquer à cette série » : case à cocher qui enregistre les pistes
 * audio/sous-titres COURANTES comme préférence de langue pour la série de
 * l'épisode en cours (et la retire quand on décoche). Tant que la case est
 * cochée, un changement de piste fait par l'utilisateur met la préférence à
 * jour.
 *
 * Cochée, la série L'EMPORTE sur le choix propre à chaque épisode et sur la
 * saison, pour l'audio ET les sous-titres : en ligne, la résolution ne
 * demande alors que la série au serveur (`trackPrefScope`) ; en lecture
 * locale, le cache de l'appareil la consulte d'abord (`seriesTrackPref`), et
 * chaque geste y est reporté aussitôt. Hors ligne, la case marche aussi : le
 * cache d'abord, le serveur au retour du réseau (`pendingPrefs`).
 *
 * Elle est rangée avec les préférences de bibliothèque
 * (`libraryId` = identifiant de la série).
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
  sideCars,
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
  /** Side-cars de la lecture locale : la langue d'un sous-titre externe (+1000). */
  sideCars?: ReadonlyArray<{ fileName: string }>;
}): ApplyToSeriesControl | undefined {
  const { t } = useTranslation("player");
  const { show } = useToast();
  const userId = useUserId();
  const offline = useOfflineMode();
  const setPref = useSetLibraryPreference();
  const delPref = useDeleteLibraryPreference();

  const seriesId = seriesIdOf(item);
  // Absente : `null` (serveur d'avant : 404, requête en erreur) → non cochée.
  const pref = useLibraryPreference(offline ? undefined : seriesId);
  // Hors ligne, la case lit le cache de l'appareil ; `localRevision` la relit après un geste.
  const [localRevision, setLocalRevision] = useState(0);
  const localPref = useMemo(
    () => (offline && userId ? seriesPrefFor(userId, seriesId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offline, userId, seriesId, localRevision],
  );
  const saved: TrackChoice | null = offline ? localPref : pref.data ?? null;
  const checked = saved !== null;

  // Ce que le serveur sait de la série entre dans le cache de l'appareil : la
  // lecture locale suivante l'applique (préférence posée sur un autre appareil comprise).
  const serverPref = pref.isSuccess ? pref.data ?? null : undefined;
  useEffect(() => {
    if (offline || !userId || !seriesId || serverPref === undefined) return;
    mirrorSeriesPref(userId, seriesId, serverPref);
  }, [offline, userId, seriesId, serverPref]);

  const currentChoice = useCallback(
    () => trackChoiceOf({ streams, audioIndex, subtitleIndex, sideCars }),
    [streams, audioIndex, subtitleIndex, sideCars],
  );

  /** Le cache d'abord — la lecture locale le lit —, puis la file si le serveur est loin. */
  const writeLocal = useCallback((choice: TrackChoice | null, queue: boolean) => {
    if (!userId || !seriesId) return;
    mirrorSeriesPref(userId, seriesId, choice);
    if (queue) {
      queuePendingPref(
        userId,
        choice === null
          ? { libraryId: seriesId, audioLang: null, subtitleLang: null, subtitleMode: "none", reset: true }
          : { libraryId: seriesId, ...choice },
      );
    }
    setLocalRevision((n) => n + 1);
  }, [userId, seriesId]);

  const toggle = useCallback((next: boolean) => {
    if (!seriesId) return;
    const choice = next ? currentChoice() : null;
    if (offline) {
      writeLocal(choice, true);
      show(next ? "success" : "info", t(next ? "appliedToSeries" : "seriesPreferenceCleared"));
      return;
    }
    if (choice !== null) {
      setPref.mutate(
        { libraryId: seriesId, ...choice },
        {
          onSuccess: () => { writeLocal(choice, false); show("success", t("appliedToSeries")); },
          onError: () => show("error", t("applyToSeriesFailed")),
        },
      );
    } else {
      const cleared = () => { writeLocal(null, false); show("info", t("seriesPreferenceCleared")); };
      // 404 = déjà absente : l'état visé est atteint, pas d'erreur à montrer.
      delPref.mutate(seriesId, { onSuccess: cleared, onError: cleared });
    }
  }, [seriesId, currentChoice, offline, writeLocal, setPref, delPref, show, t]);

  // Case cochée + changement de piste PAR L'UTILISATEUR → la préférence suit
  // (mise à jour silencieuse). Sans action utilisateur (overrides), on ne
  // touche à rien : les pistes du montage peuvent différer de la préférence
  // (piste absente du média) sans que ce soit un choix.
  useEffect(() => {
    if (!seriesId || saved === null || setPref.isPending) return;
    if (!audioOverrideRef.current && !subtitleOverrideRef.current) return;
    const current = currentChoice();
    if (sameTrackChoice(saved, current)) return;
    if (offline) writeLocal(current, true);
    else setPref.mutate({ libraryId: seriesId, ...current }, { onSuccess: () => writeLocal(current, false) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, saved, audioIndex, subtitleIndex, localRevision]);

  const choice = useMemo(() => saved ?? currentChoice(), [saved, currentChoice]);

  if (!seriesId) return undefined;
  return { checked, pending: setPref.isPending || delPref.isPending, toggle, choice };
}
