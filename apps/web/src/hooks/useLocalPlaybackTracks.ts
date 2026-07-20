/**
 * Pistes du lecteur en LECTURE LOCALE.
 *
 * En ligne, les menus audio/sous-titres et la résolution des préférences
 * viennent du DTO Jellyfin (résolu côté serveur). Hors ligne (item absent),
 * ce DTO n'existe pas : on peuple les menus depuis la track-list mpv du
 * fichier local (source de vérité pour un fichier), et on applique les
 * préférences de langue depuis le cache local — le tout remonté par les
 * callbacks existants (onAudioChange/onSubtitleChange), donc le pipeline
 * d'application mpv (useMpvTrackSync) reste unique et inchangé.
 */

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import type { MpvTrack } from "./useDesktopPlayer";
import { prefForLibrary, sameLang } from "../offline/localTrackPrefs";
import { formatLocalTrackLabel } from "./localTrackLabels";

/** Contexte de libellé : langue d'interface + repli traduit. */
interface LabelContext {
  locale: string;
  fallbackFor: (index: number) => string;
}

interface Options {
  isLocalPlayback: boolean;
  offline: boolean;
  fileLoaded: boolean;
  ready: boolean;
  /** DTO Jellyfin (présent en ligne, vide hors ligne). */
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  mpvAudio: MpvTrack[];
  mpvSubs: MpvTrack[];
  localLibraryId: string | null;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  /** Clé de source : réinitialise l'application des préférences. */
  sourceKey: string;
}

function mpvAudioToTracks(tracks: MpvTrack[], ctx: LabelContext): AudioTrack[] {
  return tracks
    .filter((t) => typeof t.id === "number")
    .map((t) => ({
      index: t.id,
      label: formatLocalTrackLabel(t, { locale: ctx.locale, fallback: ctx.fallbackFor(t.id) }),
      lang: t.lang ?? undefined,
    }));
}

function mpvSubsToTracks(tracks: MpvTrack[], ctx: LabelContext): SubtitleTrack[] {
  return tracks
    .filter((t) => typeof t.id === "number")
    .map((t) => ({
      index: t.id,
      label: formatLocalTrackLabel(t, { locale: ctx.locale, fallback: ctx.fallbackFor(t.id) }),
      url: "", // piste interne — mpv la lit nativement (sid), pas d'URL
      lang: t.lang ?? undefined,
    }));
}

export function useLocalPlaybackTracks({
  isLocalPlayback, offline, fileLoaded, ready,
  audioTracks, subtitleTracks, mpvAudio, mpvSubs,
  localLibraryId, onAudioChange, onSubtitleChange, sourceKey,
}: Options): { displayAudio: AudioTrack[]; displaySubs: SubtitleTrack[] } {
  const userId = useUserId();
  const { t, i18n } = useTranslation("player");
  const labelCtx = useMemo<LabelContext>(
    () => ({
      locale: i18n.language || "fr",
      fallbackFor: (index: number) => t("player:trackFallback", { index }),
    }),
    [i18n.language, t],
  );

  // Menus : DTO Jellyfin si présent, sinon pistes mpv (hors ligne).
  const displayAudio = useMemo(
    () => (audioTracks.length > 0 || !isLocalPlayback ? audioTracks : mpvAudioToTracks(mpvAudio, labelCtx)),
    [audioTracks, isLocalPlayback, mpvAudio, labelCtx],
  );
  const displaySubs = useMemo(
    () => (subtitleTracks.length > 0 || !isLocalPlayback ? subtitleTracks : mpvSubsToTracks(mpvSubs, labelCtx)),
    [subtitleTracks, isLocalPlayback, mpvSubs, labelCtx],
  );

  // Application des préférences hors ligne : une fois, quand la track-list mpv
  // est disponible. En ligne, la résolution serveur (useWatchSession) s'en
  // charge déjà — on ne double pas.
  const appliedForSource = useRef("");
  useEffect(() => {
    if (!isLocalPlayback || !offline || !fileLoaded || !ready || !userId) return;
    if (mpvAudio.length === 0 && mpvSubs.length === 0) return;
    if (appliedForSource.current === sourceKey) return;
    const pref = prefForLibrary(userId, localLibraryId);
    if (!pref) return;
    appliedForSource.current = sourceKey;

    if (pref.audioLang) {
      const match = mpvAudio.find((t) => sameLang(t.lang, pref.audioLang));
      if (match) onAudioChange(match.id);
    }
    if (pref.subtitleMode === "none") {
      onSubtitleChange(null);
    } else {
      const wantForced = pref.subtitleMode === "forced" || pref.subtitleMode === "signs";
      const exact = mpvSubs.find(
        (t) => sameLang(t.lang, pref.subtitleLang) && (wantForced ? t.forced === true : !t.forced),
      );
      const any = mpvSubs.find((t) => sameLang(t.lang, pref.subtitleLang));
      const chosen = exact ?? (wantForced ? undefined : any);
      if (chosen) onSubtitleChange(chosen.id);
    }
  }, [isLocalPlayback, offline, fileLoaded, ready, userId, mpvAudio, mpvSubs, localLibraryId, sourceKey, onAudioChange, onSubtitleChange]);

  return { displayAudio, displaySubs };
}
