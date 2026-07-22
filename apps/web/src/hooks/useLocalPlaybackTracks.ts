/**
 * Pistes du lecteur en LECTURE LOCALE.
 *
 * En streaming, les menus audio/sous-titres et la résolution des préférences
 * viennent du DTO Jellyfin (résolu côté serveur). En LECTURE LOCALE — en ligne
 * comme hors ligne, zéro réseau — les menus viennent du DTO snapshot quand il
 * existe, sinon de la track-list mpv du fichier ET des side-cars téléchargés,
 * et les préférences sont résolues localement avec `resolveMediaTracks` — LE
 * MÊME algorithme que le backend (alias de langues, variantes VFF/VFQ,
 * heuristique des pistes forcées, modes signs/always). Le résultat est remonté
 * par les callbacks existants (onAudioChange/onSubtitleChange), donc le
 * pipeline d'application mpv (useMpvTrackSync) reste unique et inchangé.
 */

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { resolveMediaTracks, type LibraryPreference } from "@tentacle-tv/shared";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import type { MpvTrack } from "./useDesktopPlayer";
import type { LocalSubtitleFile } from "../downloads/playbackApi";
import { prefForLibrary } from "../offline/localTrackPrefs";
import {
  buildLocalAudioTracks,
  buildLocalSubtitleTracks,
  isForcedTrack,
  type LabelContext,
} from "./localPlaybackTrackSources";

interface Options {
  isLocalPlayback: boolean;
  fileLoaded: boolean;
  ready: boolean;
  /** DTO Jellyfin (présent en ligne, vide hors ligne). */
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  mpvAudio: MpvTrack[];
  mpvSubs: MpvTrack[];
  /** Side-cars téléchargés — seuls sous-titres de la variante Allégée. */
  localSubtitleFiles: LocalSubtitleFile[];
  localLibraryId: string | null;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  /** Clé de source : réinitialise l'application des préférences. */
  sourceKey: string;
}

/**
 * `langMatches` compare des codes de langue NUS : une piste « fr-BE » ne
 * correspondrait à aucune préférence sans ce découpage.
 */
function baseLang(lang: string | undefined): string | undefined {
  return lang?.split("-")[0].toLowerCase();
}

export function useLocalPlaybackTracks({
  isLocalPlayback, fileLoaded, ready,
  audioTracks, subtitleTracks, mpvAudio, mpvSubs, localSubtitleFiles,
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

  // Menus : DTO Jellyfin si présent, sinon pistes locales (mpv + side-cars).
  const displayAudio = useMemo(
    () => (audioTracks.length > 0 || !isLocalPlayback
      ? audioTracks
      : buildLocalAudioTracks(mpvAudio, labelCtx)),
    [audioTracks, isLocalPlayback, mpvAudio, labelCtx],
  );
  const displaySubs = useMemo(
    () => (subtitleTracks.length > 0 || !isLocalPlayback
      ? subtitleTracks
      : buildLocalSubtitleTracks(mpvSubs, localSubtitleFiles, labelCtx)),
    [subtitleTracks, isLocalPlayback, mpvSubs, localSubtitleFiles, labelCtx],
  );

  // Application des préférences en lecture locale (en ligne comme hors
  // ligne) : une fois, quand les pistes du fichier sont connues. En streaming,
  // la résolution serveur (useServerTrackPrefs) s'en charge — on ne double pas
  // (elle est neutralisée dès que isLocalPlayback).
  const appliedForSource = useRef("");
  useEffect(() => {
    if (!isLocalPlayback || !fileLoaded || !ready || !userId) return;
    if (displayAudio.length === 0 && displaySubs.length === 0) return;
    if (appliedForSource.current === sourceKey) return;
    const cached = prefForLibrary(userId, localLibraryId);
    if (!cached) return;
    appliedForSource.current = sourceKey;

    // Même résolveur que le backend : les préférences se comportent à
    // l'identique en ligne et hors ligne.
    const pref: LibraryPreference = {
      jellyfinUserId: userId,
      libraryId: cached.libraryId,
      audioLang: cached.audioLang,
      subtitleLang: cached.subtitleLang,
      subtitleMode: cached.subtitleMode,
    };
    const mpvById = new Map(mpvAudio.map((track) => [track.id, track]));
    const { audioIndex, subtitleIndex } = resolveMediaTracks(
      pref,
      displayAudio.map((track) => ({
        index: track.index,
        language: baseLang(track.lang),
        isDefault: mpvById.get(track.index)?.default === true,
        title: track.label,
      })),
      displaySubs.map((track) => ({
        index: track.index,
        language: baseLang(track.lang),
        isForced: isForcedTrack(track),
        title: track.label,
      })),
    );

    if (audioIndex != null) onAudioChange(audioIndex);
    onSubtitleChange(subtitleIndex);
  }, [isLocalPlayback, fileLoaded, ready, userId, displayAudio, displaySubs,
      mpvAudio, localLibraryId, sourceKey, onAudioChange, onSubtitleChange]);

  return { displayAudio, displaySubs };
}
