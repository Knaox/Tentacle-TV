import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isTransientPreviewRefusal, previewRetryDelayMs, trailerPreviewResultTtl, useTentacleConfig, useTrailerPreviewStream,
} from "@tentacle-tv/api-client";
import {
  TRAILER_PREVIEW_HLS_MIME,
  TRAILER_PREVIEW_TIMING,
  trailerPreviewMounted,
  trailerPreviewPlaying,
  trailerPreviewSubjectKey,
  trailerPreviewVisible,
  trailerPreviewWantsStream,
  uiLanguage,
  type TrailerPreviewSubject,
} from "@tentacle-tv/shared";
import { TV_TRAILER_PREVIEW_TIMING, previewStartPosition, previewVideoKey } from "@tentacle-tv/tv-core";
import { useTrailerPreviewSound } from "../../lib/trailerPreviewSettings";
import { PreviewVideo } from "./PreviewVideo";
import { previewArbiter, previewMemory, useAppActive } from "./previewDevice";
import { previewParking, useParkedVideo } from "./previewParking";
import { useTvPreviewMachine } from "./useTvPreviewMachine";

/** Le flux d'un cycle : l'adresse absolue, et d'où partir. */
interface CycleStream {
  cycle: number;
  uri: string;
  hls: boolean;
  videoKey: string;
  startAt: number;
}

export interface PreviewSessionProps {
  subject: TrailerPreviewSubject;
  focused: boolean;
  /** La grande carte peut se montrer (première image là, rendez-vous passé). */
  onExpanded: (expanded: boolean) => void;
  /** La vidéo existe (chargée cachée, montrée, ou dans son repli) : la session doit rester montée. */
  onBusy: (busy: boolean) => void;
}

/**
 * L'aperçu d'UNE carte focalisée — le portage du crochet du bureau
 * (`apps/web/src/trailerPreview/useTrailerPreview.ts`) sur le focus :
 *
 *   - la demande au serveur part à l'INTENTION (une seconde de focus tenu,
 *     tv-core `TV_TRAILER_PREVIEW_TIMING`) ; partie, elle va au bout même si
 *     le focus s'en va — sa réponse, gardée, sert le retour sur la carte ;
 *   - un refus passager (429, panne, délai) se redemande à son échéance si le
 *     focus tient, deux fois au plus ; un refus vaut « rien à montrer » ;
 *   - la vidéo se charge cachée et en pause ; la carte grandit au plus tôt à
 *     1,8 s, et seulement avec sa première image ;
 *   - une vidéo qui lâche n'est pas redemandée de sitôt (mémoire de
 *     l'appareil) ; un seul aperçu à la fois (l'arbitre) ;
 *   - la vidéo finie de sortir reste GARÉE, en pause, jusqu'au calme de la
 *     télécommande (`previewParking`) : son lecteur ne se démonte jamais au
 *     milieu d'une rafale de flèches ;
 *   - app en arrière-plan, serveur sans `trailers.preview` : rien.
 *
 * Montée par le port seulement pour la carte focalisée (et le temps de son
 * repli) : les autres cartes d'une rangée ne paient rien.
 */
export const PreviewSession = memo(function PreviewSession({ subject, focused, onExpanded, onBusy }: PreviewSessionProps) {
  const { i18n } = useTranslation();
  const lang = uiLanguage(i18n.language);
  const { storage } = useTentacleConfig();
  const subjectKey = trailerPreviewSubjectKey(subject);
  // Le sujet n'a d'identité que par sa clé : un modèle reconstruit ne relance rien.
  const subjectRef = useRef(subject);
  if (trailerPreviewSubjectKey(subjectRef.current) !== subjectKey) subjectRef.current = subject;
  const stableSubject = subjectRef.current;

  const appActive = useAppActive();
  const sound = useTrailerPreviewSound();
  const [wantsStream, setWantsStream] = useState(false);
  const stream = useTrailerPreviewStream(stableSubject, lang, { enabled: wantsStream && !previewMemory.recentlyFailed(subjectKey) });
  const [state, dispatch] = useTvPreviewMachine(focused, !appActive || !stream.capable, subjectKey);
  const wants = trailerPreviewWantsStream(state);
  useEffect(() => setWantsStream(wants), [wants]);

  // La réponse du serveur, quand l'intention l'attend — chaque réponse lue UNE
  // fois par cycle ; le flux est FIGÉ pour le cycle (cf. le crochet du bureau).
  const { result, fresh, receivedAt, loading } = stream;
  const [cycleStream, setCycleStream] = useState<CycleStream | null>(null);
  const consumed = useRef({ cycle: -1, at: 0 });
  useEffect(() => {
    if (state.phase !== "fetching" || state.retryAt !== null || loading) return;
    const at = Date.now();
    if (previewMemory.recentlyFailed(subjectKey)) {
      dispatch({ type: "streamMissing", at });
      return;
    }
    const seen = consumed.current.cycle === state.cycle ? consumed.current.at : 0;
    if (!result || receivedAt <= seen) return;
    if (!fresh) {
      if (receivedAt < (state.since ?? 0) || trailerPreviewResultTtl(result, receivedAt) > 0) return;
      consumed.current = { cycle: state.cycle, at: receivedAt };
      dispatch({ type: "streamRetry", at, retryAt: at + TRAILER_PREVIEW_TIMING.timeoutRetryMs });
      return;
    }
    consumed.current = { cycle: state.cycle, at: receivedAt };
    if (result.status === "found") {
      const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/+$/, "");
      const hls = result.preview.mimeType === TRAILER_PREVIEW_HLS_MIME;
      const videoKey = previewVideoKey(result.preview.path);
      const startAt = previewStartPosition({ resumeAt: previewMemory.positionOf(videoKey), hls });
      setCycleStream({ cycle: state.cycle, uri: `${serverUrl}${result.preview.path}`, hls, videoKey, startAt });
      dispatch({ type: "streamFound", at });
    } else if (isTransientPreviewRefusal(result)) {
      dispatch({ type: "streamRetry", at, retryAt: receivedAt + previewRetryDelayMs(result, state.retries) });
    } else {
      dispatch({ type: "streamMissing", at });
    }
  }, [state.phase, state.cycle, state.since, state.retryAt, state.retries, result, fresh, receivedAt, loading, subjectKey, storage, dispatch]);

  // L'échéance d'un refus passager est passée, le focus tient : nouvelle demande.
  const retryStream = stream.retry;
  useEffect(() => {
    if (state.attempt > 0) retryStream();
  }, [state.attempt, retryStream]);

  // Une vidéo qui a lâché ici : la réponse qui la désignait n'est plus crue.
  // Lue fraîche pour ce focus, la vidéo n'est pas retentée de sitôt ; gardée
  // d'un focus précédent, c'est la réponse qui est suspecte (un jeton mort
  // avec un redémarrage du serveur) : seule la réponse est oubliée.
  const cycleTitle = useRef({ cycle: -1, key: subjectKey, forget: stream.forget });
  if (cycleTitle.current.cycle !== state.cycle) cycleTitle.current = { cycle: state.cycle, key: subjectKey, forget: stream.forget };
  const handledFailure = useRef(-1);
  const { since } = state;
  useEffect(() => {
    if (state.phase !== "failed" || state.failure !== "video" || handledFailure.current === state.cycle) return;
    const title = cycleTitle.current;
    if (title.cycle !== state.cycle) return;
    handledFailure.current = state.cycle;
    title.forget();
    const reused = consumed.current.cycle === state.cycle && since !== null && consumed.current.at < since;
    if (!reused) previewMemory.rememberFailure(title.key);
  }, [state.phase, state.failure, state.cycle, since]);

  // Un seul aperçu à la fois : la place se prend à la demande, se rend à la fin.
  const holder = useRef({}).current;
  useEffect(() => {
    if (!wants) return undefined;
    // Un moment de calme (un focus tenu) : la vidéo garée d'un aperçu précédent se démonte.
    previewParking.releaseAll();
    previewArbiter.claim(holder, () => dispatch({ type: "preempted", at: Date.now() }));
    return () => previewArbiter.release(holder);
  }, [wants, holder, dispatch]);

  const current = cycleStream?.cycle === state.cycle ? cycleStream : null;
  // La vidéo que la machine monte ; lâchée, elle reste garée jusqu'au calme (`previewParking`).
  const video = useParkedVideo(trailerPreviewMounted(state) ? current : null);
  const mount = video !== null;
  const expanded = trailerPreviewVisible(state) && current !== null;
  const playing = trailerPreviewPlaying(state) && video === current;
  useEffect(() => onExpanded(expanded), [expanded, onExpanded]);
  useEffect(() => onBusy(mount), [mount, onBusy]);
  // La télécommande suivie tant qu'une vidéo existe : le garage attend son calme.
  useEffect(() => (mount ? previewParking.watch() : undefined), [mount]);
  useEffect(() => () => {
    onExpanded(false);
    onBusy(false);
  }, [onExpanded, onBusy]);

  // La vidéo garée d'un cycle passé ne parle plus à la machine : elle vit déjà le cycle suivant.
  const live = useRef(false);
  live.current = video !== null && video === current;
  const onReady = useCallback(() => {
    if (live.current) dispatch({ type: "videoReady", at: Date.now() });
  }, [dispatch]);
  const onError = useCallback(() => {
    if (live.current) dispatch({ type: "videoFailed", at: Date.now() });
  }, [dispatch]);
  const videoKey = video?.videoKey;
  const onEnded = useCallback(() => {
    if (videoKey) previewMemory.forgetPosition(videoKey);
    if (live.current) dispatch({ type: "videoEnded", at: Date.now() });
  }, [dispatch, videoKey]);
  const onPosition = useCallback((position: number, duration: number) => {
    if (videoKey) previewMemory.savePosition(videoKey, position, duration > 0 ? duration : undefined);
  }, [videoKey]);

  if (!video) return null;
  return (
    <PreviewVideo
      key={video.cycle}
      uri={video.uri}
      hls={video.hls}
      startAt={video.startAt}
      playing={playing}
      muted={!sound}
      volume={TV_TRAILER_PREVIEW_TIMING.volume}
      onReady={onReady}
      onError={onError}
      onEnded={onEnded}
      onPosition={onPosition}
    />
  );
});
