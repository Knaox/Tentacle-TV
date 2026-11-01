/**
 * Octave (web, bureau) — l'AVIS d'un titre illisible touché (`trackPlayability.ts`, lot « ol ») : une rangée grisée
 * cliquée, une entrée de la file d'attente, le meilleur résultat. Rien ne se lance, la lecture en cours continue ;
 * l'avis dit POURQUOI en mots simples et garde les gestes qui restent : « Favori » et « Ajouter à une playlist » —
 * le serveur pourra le récupérer. Deux clics rapprochés sur le même titre ne le disent qu'une fois.
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { openPlaylistChooser } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { onUnavailableTrack, unplayableNotice, type UnplayableGesture } from "@tentacle-tv/shared/octave";
import { useToast, type ToastAction } from "../../../contexts/ToastContext";
import { likeOverrideOf } from "./likeOverrides";
import { useTrackActions } from "./useTrackActions";

/** Un même avis n'est pas redit avant ce délai (double clic, Entrée maintenue). */
const REPEAT_MS = 2_000;

export function UnavailableTrackNoticeHost(): null {
  const { t } = useTranslation("music");
  const toast = useToast();
  const actions = useTrackActions();
  // Les gestes du compte changent (droits, playlists) : lus au moment de l'avis, sans réabonner.
  const live = useRef(actions);
  live.current = actions;
  useEffect(() => {
    let last = { at: 0, key: null as string | null };
    return onUnavailableTrack((track) => {
      const now = Date.now();
      if (now - last.at < REPEAT_MS && last.key === (track?.key ?? null)) return;
      last = { at: now, key: track?.key ?? null };
      if (!track) return toast.show("info", t("track.unavailableNotice"));
      const { title, message, action, secondaryAction } = noticeOf(track, live.current, t);
      toast.show("info", message, { title, action, secondaryAction });
    });
  }, [t, toast]);
  return null;
}

type Translate = (key: string) => string;

function noticeOf(track: MusicTrack, actions: ReturnType<typeof useTrackActions>, t: Translate) {
  const liked = likeOverrideOf(track.key) ?? track.favorite;
  const notice = unplayableNotice(track, { canLike: actions.canLike(track), canAddToPlaylist: actions.canAddToPlaylist(track), liked });
  const gesture = (g: UnplayableGesture): ToastAction =>
    g === "addToPlaylist"
      ? { label: t("unplayableTrack.addToPlaylist"), onPress: () => openPlaylistChooser(track) }
      : { label: t("unplayableTrack.like"), onPress: () => actions.toggleLike(track) };
  const [first, second] = notice.gestures.map(gesture);
  // Deux gestes : le principal (en couleur) à droite, l'autre avant lui.
  return {
    title: t(notice.titleKey),
    message: notice.keepKey ? `${t(notice.reasonKey)} ${t(notice.keepKey)}` : t(notice.reasonKey),
    action: first,
    secondaryAction: second,
  };
}
