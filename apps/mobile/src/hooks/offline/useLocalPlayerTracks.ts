import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OnLoadData } from "react-native-video";
import { i18n, resolveMediaTracks, type MediaStream as JfStream } from "@tentacle-tv/shared";
import {
  formatLocalTrackLabel,
  itemTracksFor,
  matchAudioStreams,
  parseSideCarFileName,
  prefForLibrary,
  snapshotTrackLabel,
  subtitleModeOf,
  type ItemTrackChoice,
  type SnapshotStream,
  type SubtitleMode,
} from "@tentacle-tv/offline-core";
import type { OfflineLocalSource } from "@/offline/engineApi";
import { prefsStore } from "@/offline/prefsCache";
import { useRememberLocalTracks } from "./useRememberLocalTracks";

export interface Track {
  index: number;
  label: string;
  lang?: string;
  forced?: boolean;
  sdh?: boolean;
  /** Le `Title` Jellyfin du flux, quand le snapshot le connaît. */
  title?: string;
  /** La piste par défaut du fichier (snapshot, sinon le lecteur natif). */
  isDefault?: boolean;
}

type NativeAudioTrack = OnLoadData["audioTracks"][number];

/** `langMatches` compare des codes nus : « fr-BE » ne correspondrait à rien sans ce découpage. */
const baseLang = (lang: string | undefined): string | undefined => lang?.split("-")[0]?.toLowerCase();

/** Les flux du snapshot sous la forme que l'appariement attend (un index numérique). */
function toSnapshotStreams(streams: readonly JfStream[]): SnapshotStream[] {
  return streams.flatMap((stream) =>
    typeof stream.Index === "number"
      ? [{
          Type: stream.Type ?? "",
          Index: stream.Index,
          Language: stream.Language,
          Title: stream.Title,
          DisplayTitle: stream.DisplayTitle,
          Codec: stream.Codec,
          IsDefault: stream.IsDefault,
          IsForced: stream.IsForced,
        }]
      : [],
  );
}

interface Options {
  userId: string | null;
  itemId: string;
  localSource: OfflineLocalSource;
  /** Les pistes du snapshot — leurs `DisplayTitle` nomment les pistes comme en ligne. */
  streams: JfStream[];
}

/**
 * Les pistes d'une lecture LOCALE. L'audio vient de la liste NATIVE du fichier
 * (`onLoad.audioTracks`, comme la track-list mpv du bureau — un lecteur qui
 * omet une piste ne décale rien), les sous-titres des side-cars VTT ; chaque
 * piste retrouve son flux du snapshot et porte le NOM que Jellyfin affiche
 * (« Français - AAC - Stereo », « English (SDH) »). Les langues préférées sont
 * résolues localement par LE MÊME algorithme que le serveur (le contenu
 * d'abord, la bibliothèque ensuite), une fois, quand le fichier est chargé ;
 * un choix explicite est mémorisé.
 */
export function useLocalPlayerTracks({ userId, itemId, localSource, streams }: Options) {
  const { t } = useTranslation("player");
  const [nativeAudio, setNativeAudio] = useState<readonly NativeAudioTrack[]>([]);
  /** Index NATIF de la piste audio (-1 : laisser le lecteur choisir). */
  const [audioIndex, setAudioIndex] = useState(-1);
  /** Index Jellyfin du side-car choisi (-1 : aucun). */
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const appliedRef = useRef(false);
  const [override, setOverride] = useState(false);
  const label = useCallback(
    (track: { lang?: string; title?: string; codec?: string; forced?: boolean; sdh?: boolean }, index: number) =>
      formatLocalTrackLabel(track, { locale: i18n.language, fallback: t("trackFallback", { index, defaultValue: `#${index}` }) }),
    [t],
  );
  const snapshotStreams = useMemo(() => toSnapshotStreams(streams), [streams]);

  const onLoad = useCallback((data: OnLoadData) => {
    setNativeAudio(data.audioTracks ?? []);
  }, []);

  const audioTracks: Track[] = useMemo(() => {
    const matched = matchAudioStreams(nativeAudio, snapshotStreams, {
      variant: localSource.variant,
      audioStreamIndex: localSource.audioStreamIndex,
    });
    return nativeAudio.map((track, position) => {
      const stream = matched[position] ?? null;
      return {
        index: track.index,
        label: snapshotTrackLabel(stream, () => label({ lang: track.language, title: track.title }, track.index)),
        lang: baseLang(stream?.Language ?? track.language),
        title: stream?.Title,
        isDefault: stream?.IsDefault ?? track.selected === true,
      };
    });
  }, [nativeAudio, snapshotStreams, localSource.variant, localSource.audioStreamIndex, label]);

  const sideCars = useMemo(
    () => localSource.subtitleUris
      .map((file) => ({ ...file, parsed: parseSideCarFileName(file.fileName) }))
      .filter((file) => file.parsed !== null && file.parsed.format === "vtt"),
    [localSource.subtitleUris],
  );
  const subtitleTracks: Track[] = useMemo(
    () => sideCars.map((file) => {
      const parsed = file.parsed!;
      // Le side-car porte l'index Jellyfin d'origine : le flux se retrouve exactement.
      const stream = snapshotStreams.find((s) => s.Type === "Subtitle" && s.Index === parsed.jfIndex) ?? null;
      return {
        index: parsed.jfIndex,
        label: snapshotTrackLabel(stream, () =>
          label({ lang: parsed.lang, title: stream?.Title, codec: parsed.format, forced: parsed.forced, sdh: parsed.sdh }, parsed.jfIndex)),
        lang: baseLang(stream?.Language ?? parsed.lang),
        forced: parsed.forced || stream?.IsForced === true,
        sdh: parsed.sdh,
        title: stream?.Title,
      };
    }),
    [sideCars, snapshotStreams, label],
  );
  const subtitleVttUrl = useMemo(
    () => sideCars.find((file) => file.parsed!.jfIndex === subtitleIndex)?.uri ?? null,
    [sideCars, subtitleIndex],
  );

  // Résolution des préférences : une fois, quand les pistes du fichier sont connues.
  useEffect(() => {
    if (appliedRef.current || userId === null || nativeAudio.length === 0) return;
    appliedRef.current = true;
    const cached = itemTracksFor(prefsStore, userId, itemId) ?? prefForLibrary(prefsStore, userId, localSource.libraryId);
    if (!cached) return;
    const resolved = resolveMediaTracks(
      { jellyfinUserId: userId, libraryId: localSource.libraryId ?? "", audioLang: cached.audioLang, subtitleLang: cached.subtitleLang, subtitleMode: cached.subtitleMode },
      audioTracks.map((track) => ({ index: track.index, language: track.lang, isDefault: track.isDefault === true, title: track.label })),
      subtitleTracks.map((track) => ({ index: track.index, language: track.lang, isForced: track.forced === true, title: track.label })),
    );
    if (resolved.audioIndex != null) setAudioIndex(resolved.audioIndex);
    setSubtitleIndex(resolved.subtitleIndex ?? -1);
  }, [userId, itemId, localSource.libraryId, nativeAudio, audioTracks, subtitleTracks]);

  const changeAudio = useCallback((index: number) => { setOverride(true); setAudioIndex(index); }, []);
  const changeSubtitle = useCallback((index: number) => { setOverride(true); setSubtitleIndex(index); }, []);

  // Le choix explicite, mémorisé (miroir local, puis serveur en ligne) — le
  // mode se lit sur les drapeaux de la piste, jamais sur son libellé.
  const choice = useMemo<ItemTrackChoice | null>(() => {
    if (!override) return null;
    const audioLang = audioTracks.find((track) => track.index === audioIndex)?.lang ?? null;
    const sub = subtitleTracks.find((track) => track.index === subtitleIndex);
    const subtitleMode: SubtitleMode = !sub
      ? "none"
      : subtitleModeOf({ forced: sub.forced === true, sdh: sub.sdh === true, title: sub.title, displayTitle: sub.label });
    return { audioLang, subtitleLang: sub?.lang ?? null, subtitleMode };
  }, [override, audioTracks, subtitleTracks, audioIndex, subtitleIndex]);
  useRememberLocalTracks({ userId, itemId, choice });

  return { onLoad, audioTracks, subtitleTracks, audioIndex, subtitleIndex, subtitleVttUrl, changeAudio, changeSubtitle };
}
