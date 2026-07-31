import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import { findMpvTrack, nativeSubUrl } from "../components/player/mpvTrackMapping";
import { isSideCarIndex } from "./localPlaybackTrackSources";
import type { MpvState, MpvTrack } from "./useDesktopPlayer";

const DBG = "[DesktopPlayer]";

interface UseMpvTrackSyncOptions {
  state: MpvState;
  ready: boolean;
  fileLoaded: boolean;
  isDirectPlay: boolean;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  mpvAudio: MpvTrack[];
  mpvSubs: MpvTrack[];
  currentAudio: number;
  currentSubtitle: number | null;
  setAudioTrack: (id: number) => Promise<void>;
  setSubtitleTrack: (id: number) => Promise<void>;
  addSubtitle: (url: string, select?: boolean) => Promise<number | null>;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  loadedExternalSubs: MutableRefObject<Map<number, number>>;
}

/**
 * Synchronisation des pistes Jellyfin ↔ mpv : handlers de changement
 * audio/sous-titres + application des préférences (gated fileLoaded/ready).
 */
export function useMpvTrackSync({
  state, ready, fileLoaded, isDirectPlay,
  audioTracks, subtitleTracks, mpvAudio, mpvSubs,
  currentAudio, currentSubtitle,
  setAudioTrack, setSubtitleTrack, addSubtitle,
  onAudioChange, onSubtitleChange, loadedExternalSubs,
}: UseMpvTrackSyncOptions) {
  // ── Audio change handler ──
  const handleAudioChange = useCallback((jfIndex: number) => {
    const aPos = audioTracks.findIndex((t) => t.index === jfIndex);
    console.debug(DBG, "audio change", { jfIndex, aPos, mpvAudioCount: mpvAudio.length, isDirectPlay });
    // In transcode mode, audio switching is done by rebuilding the URL with the
    // new AudioStreamIndex — mpv reloads automatically. No need to set aid.
    if (isDirectPlay) {
      let mpvId: number | null = null;
      if (mpvAudio.length > 0) {
        mpvId = findMpvTrack(jfIndex, audioTracks, mpvAudio);
        if (mpvId == null && aPos >= 0 && aPos < mpvAudio.length) {
          mpvId = mpvAudio[aPos].id;
        }
      }
      if (mpvId == null && aPos >= 0) {
        mpvId = aPos + 1;
      }
      console.debug(DBG, "mapped audio", { jfIndex, mpvId });
      if (mpvId != null) setAudioTrack(mpvId);
    }
    onAudioChange(jfIndex);
  }, [audioTracks, mpvAudio, setAudioTrack, onAudioChange, isDirectPlay]);

  // ── Sélection d'une piste externe (sub-add du format natif ass/srt) ──
  // Mémorise le sid attribué (jfIndex → sid, purgé à chaque source) : une
  // re-sélection réutilise la piste au lieu de re-sub-add (mpv dupliquerait).
  // pendingExternal évite le double sub-add concurrent (handler + effet de préf).
  const pendingExternal = useRef<Set<number>>(new Set());
  const selectExternalSub = useCallback(async (jfIndex: number) => {
    const known = loadedExternalSubs.current.get(jfIndex);
    if (known != null) { await setSubtitleTrack(known); return; }
    if (pendingExternal.current.has(jfIndex)) return;
    const subTrack = subtitleTracks.find((t) => t.index === jfIndex);
    if (!subTrack?.url) return;
    pendingExternal.current.add(jfIndex);
    try {
      const url = nativeSubUrl(subTrack.url, subTrack.codec);
      console.debug(DBG, "loading external subtitle", { url: url.substring(0, 80), codec: subTrack.codec });
      const sid = await addSubtitle(url, true);
      if (sid != null) loadedExternalSubs.current.set(jfIndex, sid);
    } finally {
      pendingExternal.current.delete(jfIndex);
    }
  }, [subtitleTracks, addSubtitle, setSubtitleTrack, loadedExternalSubs]);

  /** Sous-titre bitmap (PGS…) ? → burn-in serveur, rien à faire côté mpv. */
  const isBitmapSub = useCallback((jfIndex: number) => {
    const codec = subtitleTracks.find((t) => t.index === jfIndex)?.codec;
    return BURN_IN_SUBTITLE_CODECS.test(codec ?? "");
  }, [subtitleTracks]);

  // ── Subtitle change handler ──
  const handleSubtitleChange = useCallback((jfIndex: number | null) => {
    console.debug(DBG, "subtitle change", { jfIndex, mpvSubsCount: mpvSubs.length, isDirectPlay });
    if (jfIndex == null) {
      setSubtitleTrack(0); // sid=no — désactive aussi une piste externe
      onSubtitleChange(null);
      return;
    }
    // Side-car local : fichier séparé, jamais dans la track-list mpv — le
    // mapping positionnel le confondrait avec une interne de même langue.
    if (isSideCarIndex(jfIndex)) {
      void selectExternalSub(jfIndex);
      onSubtitleChange(jfIndex);
      return;
    }
    if (!isDirectPlay) {
      // Transcode : les renditions VTT du manifeste HLS (SubtitleMethod=Hls,
      // requis tvOS) ne sont pas rendues par mpv → TOUJOURS charger la piste
      // externe au format natif (ass/srt, mise en forme complète). Bitmap →
      // burn-in serveur déclenché par le parent (WatchDesktop), rien ici.
      if (!isBitmapSub(jfIndex)) void selectExternalSub(jfIndex);
      onSubtitleChange(jfIndex);
      return;
    }
    const mpvId = findMpvTrack(jfIndex, subtitleTracks, mpvSubs);
    console.debug(DBG, "mapped subtitle", { jfIndex, mpvId });
    if (mpvId != null) setSubtitleTrack(mpvId);
    else void selectExternalSub(jfIndex);
    onSubtitleChange(jfIndex);
  }, [subtitleTracks, mpvSubs, isDirectPlay, isBitmapSub, setSubtitleTrack, selectExternalSub, onSubtitleChange]);

  // ── Apply audio preference from parent ──
  // Wait for fileLoaded — mpv cannot accept aid/sid before a file is loaded.
  // Also re-triggers when mpvAudio changes (queryTrackList completes).
  //
  // ⚠️ NE RIEN ENVOYER SI LA PISTE EST DÉJÀ LA BONNE. `fileLoaded` bascule sur
  // playback-restart, donc cet effet tire JUSTE APRÈS la première image — et il
  // tire deux fois, la track-list revenant 300 ms plus tard. Reposer `aid`
  // réinitialise la chaîne audio et resynchronise par un seek interne : sur un
  // flux réseau, le cache est vidé et mpv repart en attente. C'est le second
  // chargement, à l'instant précis où on le voit.
  //
  // La comparaison porte sur l'état OBSERVÉ (property-change `aid`/`sid`, cf.
  // OBSERVED_PROPERTIES), pas sur une lecture à la demande : c'est ce qui
  // distingue cette garde de 7dd496ce, dont le `getProperty` asynchrone rendait
  // volontiers `null` sur la coquille Electron — la garde ne s'activait alors
  // jamais. Elle ne couvre que l'application AUTOMATIQUE de la préférence ;
  // handleAudioChange et handleSubtitleChange, eux, envoient toujours : un
  // choix explicite de l'utilisateur ne peut pas être avalé.
  useEffect(() => {
    if (!fileLoaded || !ready) return;
    // In transcode mode, Jellyfin outputs only the selected audio track via
    // AudioStreamIndex — HLS has exactly 1 audio track (aid=1). Force it here
    // because mpv's aid persists across loadfile: if the previous direct play file
    // had aid=3 (e.g. Japanese), the new HLS stream has no track 3 → no audio.
    if (!isDirectPlay) {
      if (state.audioTrack !== 1) setAudioTrack(1);
      return;
    }
    let mpvId: number | null = null;
    if (mpvAudio.length > 0) {
      mpvId = findMpvTrack(currentAudio, audioTracks, mpvAudio);
      // Positional fallback when language matching fails
      if (mpvId == null) {
        const aPos = audioTracks.findIndex((t) => t.index === currentAudio);
        if (aPos >= 0 && aPos < mpvAudio.length) mpvId = mpvAudio[aPos].id;
      }
    } else {
      // Positional fallback when queryTrackList hasn't returned (or failed)
      const aPos = audioTracks.findIndex((t) => t.index === currentAudio);
      if (aPos >= 0) mpvId = aPos + 1;
    }
    console.debug(DBG, "pref apply audio", { currentAudio, mpvId, currentMpv: state.audioTrack,
      hasMpvTracks: mpvAudio.length > 0, jfLangs: audioTracks.map(t => t.lang), mpvLangs: mpvAudio.map(t => t.lang) });
    if (mpvId != null && mpvId !== state.audioTrack) setAudioTrack(mpvId);
  }, [currentAudio, mpvAudio, fileLoaded, ready, isDirectPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply subtitle preference from parent ──
  useEffect(() => {
    if (!fileLoaded || !ready) return;
    if (currentSubtitle == null) {
      // Même garde que pour l'audio : sans sous-titres, cet effet posait
      // `sid=no` après CHAQUE première image, alors que sid valait déjà `no`.
      if (state.subtitleTrack !== 0) {
        console.debug(DBG, "pref apply subtitle: disable (null)");
        setSubtitleTrack(0);
      }
      return;
    }

    // Side-car local : toujours par sub-add (voir handleSubtitleChange).
    if (isSideCarIndex(currentSubtitle)) {
      void selectExternalSub(currentSubtitle);
      return;
    }

    if (!isDirectPlay) {
      // Transcode : externe natif systématique (voir handleSubtitleChange).
      if (!isBitmapSub(currentSubtitle)) void selectExternalSub(currentSubtitle);
      return;
    }

    // Try embedded subtitle matching first
    if (mpvSubs.length > 0) {
      const mpvId = findMpvTrack(currentSubtitle, subtitleTracks, mpvSubs);
      console.debug(DBG, "pref apply subtitle (embedded)", { currentSubtitle, mpvId, currentMpv: state.subtitleTrack,
        jfLangs: subtitleTracks.map(t => t.lang), mpvLangs: mpvSubs.map(t => t.lang), mpvIds: mpvSubs.map(t => t.id) });
      if (mpvId != null) {
        // `sub-visibility` n'a pas à être reposé au passage : rien ne le met
        // jamais à `no` dans l'app, et son défaut mpv est `yes`.
        if (mpvId !== state.subtitleTrack) setSubtitleTrack(mpvId);
        return;
      }
    }

    // Repli externe — mais pas avant de savoir, ni pour rien. Les deux causes
    // du `sub-add : -12` vu au démarrage d'une lecture directe :
    //
    // 1. La track-list de mpv n'arrive qu'~300 ms APRÈS file-loaded (le
    //    `setTimeout(doQuery, 300)` de useMpvLifecycle), alors que cet effet
    //    tire dès playback-restart. `state.tracks` vide veut donc dire « pas
    //    encore interrogée », pas « aucune piste » — et on tombait ici en
    //    court-circuitant le mapping interne qui allait réussir. Un
    //    téléchargement pour rien, l'effet repassant de toute façon au retour
    //    de la liste. `state.tracks` plutôt que `mpvSubs` : un fichier peut
    //    n'avoir aucun sous-titre interne, il a toujours une piste vidéo.
    // 2. Jellyfin ne sait pas rendre un sous-titre BITMAP (PGS, VOBSUB) en
    //    .srt : la requête échoue et mpv rapporte -12. La branche transcode
    //    ci-dessus écarte déjà ce cas, celle-ci l'avait oublié. Ces pistes-là,
    //    mpv les lit de toute façon en interne.
    if (state.tracks.length === 0 || isBitmapSub(currentSubtitle)) return;
    void selectExternalSub(currentSubtitle);
  }, [currentSubtitle, mpvSubs, fileLoaded, ready, isDirectPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleAudioChange, handleSubtitleChange };
}
