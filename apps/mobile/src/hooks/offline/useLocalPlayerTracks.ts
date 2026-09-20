import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18n, resolveMediaTracks, type MediaStream as JfStream } from "@tentacle-tv/shared";
import {
  formatLocalTrackLabel,
  itemTracksFor,
  matchAudioStreams,
  prefForLibrary,
  readUserTrackConfig,
  resolveWithUserConfig,
  snapshotTrackLabel,
  subtitleModeOf,
  type ItemTrackChoice,
  type SnapshotStream,
  type SubtitleMode,
} from "@tentacle-tv/offline-core";
import type { OfflineLocalSource } from "@/offline/engineApi";
import type { EngineAudioTrack, EngineLoadData, PlayerEngineKind } from "@/player/engine/types";
import { prefsStore } from "@/offline/prefsCache";
import { mpvExternalSubtitles, mpvSubtitleStreams, parseSideCars } from "./localTrackLists";
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

type NativeAudioTrack = EngineAudioTrack;

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
  /** Le moteur qui lit : il fixe le sens des index et d'où viennent les sous-titres. */
  engine: PlayerEngineKind;
}

/**
 * Les pistes d'une lecture LOCALE. L'audio vient de la liste que le MOTEUR
 * annonce (`onLoad.audioTracks` : positions du lecteur système, index du
 * fichier — donc Jellyfin — pour le lecteur avancé) ; chaque piste retrouve
 * son flux du snapshot et porte le NOM que Jellyfin affiche (« Français - AAC
 * - Stereo », « English (SDH) »). Les sous-titres : side-cars VTT/SRT pour
 * l'overlay du lecteur système ; pour le lecteur avancé, les pistes du fichier
 * plus les side-cars externes, ajoutés par leur fichier. Les langues préférées
 * sont résolues localement par LE MÊME algorithme que le serveur (le contenu
 * d'abord, la bibliothèque ensuite, les réglages du compte Jellyfin en
 * dernier), une fois, quand le fichier est chargé ; un choix explicite est
 * mémorisé.
 */
export function useLocalPlayerTracks({ userId, itemId, localSource, streams, engine }: Options) {
  const mpv = engine === "mpv";
  /** Un original garde ses pistes intégrées ; une variante recompressée n'en a plus. */
  const embeddedInFile = localSource.variant === "original";
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

  const onLoad = useCallback((data: EngineLoadData) => {
    setNativeAudio(data.audioTracks);
  }, []);

  const audioTracks: Track[] = useMemo(() => {
    const matched = matchAudioStreams(nativeAudio, snapshotStreams, {
      variant: localSource.variant,
      audioStreamIndex: localSource.audioStreamIndex,
    });
    return nativeAudio.map((track, position) => {
      // Lecteur avancé sur un original : l'index de la piste EST l'index Jellyfin.
      const stream = mpv && embeddedInFile
        ? (snapshotStreams.find((s) => s.Type === "Audio" && s.Index === track.index) ?? null)
        : (matched[position] ?? null);
      return {
        index: track.index,
        label: snapshotTrackLabel(stream, () => label({ lang: track.language, title: track.title }, track.index)),
        lang: baseLang(stream?.Language ?? track.language),
        title: stream?.Title,
        isDefault: stream?.IsDefault ?? track.selected === true,
      };
    });
  }, [nativeAudio, snapshotStreams, localSource.variant, localSource.audioStreamIndex, label, mpv, embeddedInFile]);

  const allSideCars = useMemo(() => parseSideCars(localSource.subtitleUris), [localSource.subtitleUris]);
  /** L'overlay du lecteur système lit le VTT et le SRT ; l'ASS lui est illisible. */
  const overlaySideCars = useMemo(
    () => allSideCars.filter((file) => file.parsed.format === "vtt" || file.parsed.format === "srt"),
    [allSideCars],
  );
  const externalSubtitles = useMemo(
    () => (mpv ? mpvExternalSubtitles(streams, allSideCars, embeddedInFile) : []),
    [mpv, streams, allSideCars, embeddedInFile],
  );
  const subtitleTracks: Track[] = useMemo(() => {
    if (mpv) {
      return mpvSubtitleStreams(streams, externalSubtitles, embeddedInFile).map((stream) => ({
        index: stream.Index as number,
        label: snapshotTrackLabel(toSnapshotStreams([stream])[0] ?? null, () =>
          label({ lang: stream.Language, title: stream.Title, codec: stream.Codec, forced: stream.IsForced }, stream.Index as number)),
        lang: baseLang(stream.Language),
        forced: stream.IsForced === true,
        title: stream.Title,
      }));
    }
    return overlaySideCars.map((file) => {
      const parsed = file.parsed;
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
    });
  }, [mpv, streams, externalSubtitles, embeddedInFile, overlaySideCars, snapshotStreams, label]);
  /** Le lecteur avancé dessine lui-même : rien pour l'overlay. */
  const subtitleVttUrl = useMemo(
    () => (mpv ? null : (overlaySideCars.find((file) => file.parsed.jfIndex === subtitleIndex)?.uri ?? null)),
    [mpv, overlaySideCars, subtitleIndex],
  );

  // Résolution des préférences : une fois, quand les pistes du fichier sont connues.
  useEffect(() => {
    if (appliedRef.current || userId === null || nativeAudio.length === 0) return;
    appliedRef.current = true;
    const audio = audioTracks.map((track) => ({ index: track.index, language: track.lang, isDefault: track.isDefault === true, title: track.label }));
    const subs = subtitleTracks.map((track) => ({ index: track.index, language: track.lang, isForced: track.forced === true, title: track.label }));
    const libraryId = localSource.libraryId ?? "";
    // Le contenu, la bibliothèque, puis les réglages du compte Jellyfin ; sans
    // rien de tout cela, le lecteur choisit.
    const cached = itemTracksFor(prefsStore, userId, itemId) ?? prefForLibrary(prefsStore, userId, localSource.libraryId);
    const userConfig = cached ? null : readUserTrackConfig(prefsStore, userId);
    const resolved = cached
      ? resolveMediaTracks({ jellyfinUserId: userId, libraryId, audioLang: cached.audioLang, subtitleLang: cached.subtitleLang, subtitleMode: cached.subtitleMode }, audio, subs)
      : userConfig
        ? resolveWithUserConfig(userConfig, userId, libraryId, audio, subs)
        : null;
    if (resolved === null) return;
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

  return { onLoad, audioTracks, subtitleTracks, externalSubtitles, audioIndex, subtitleIndex, subtitleVttUrl, changeAudio, changeSubtitle };
}
