import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { PREVIEW_VIDEO_ERROR_GRACE_MS, previewStartPosition, previewVideoKey } from "@tentacle-tv/tv-core";
import { previewArbiter, previewMemory, useAppActive } from "./previewDevice";
import { usePreviewRemote } from "./usePreviewRemote";
import { useTvPreviewMachine } from "./useTvPreviewMachine";

/** Le flux d'un cycle : l'adresse absolue, et d'où partir. */
interface CycleStream {
  cycle: number;
  uri: string;
  hls: boolean;
  videoKey: string;
  startAt: number;
}

/**
 * Ce que la session veut du lecteur UNIQUE de la zone (`ZoneVideo`) : la source
 * du cycle, si elle joue, et à qui dire ce qui lui arrive. `null` : rien à
 * charger pour ce titre.
 */
export interface ZoneVideoWant {
  uri: string;
  hls: boolean;
  startAt: number;
  playing: boolean;
  onReady: () => void;
  onError: () => void;
  onEnded: () => void;
  onPosition: (position: number, duration: number) => void;
}

export interface ZoneSessionProps {
  /** La clé du sujet : chaque avis la porte (la zone ignore ceux d'une session quittée). */
  sessionKey: string;
  subject: TrailerPreviewSubject;
  focused: boolean;
  /** L'arrivée du focus : la machine en part, même montée après (le focus a dû tenir). */
  since: number | null;
  /** La vidéo peut se montrer dans la zone (première image là, délai de l'utilisateur passé). */
  onShown: (sessionKey: string, shown: boolean) => void;
  /** La vidéo à charger (ou `null`) : la zone la passe à son lecteur. Tant qu'il y en a une, la session reste montée. */
  onVideo: (sessionKey: string, want: ZoneVideoWant | null) => void;
}

/**
 * L'aperçu du titre de la ZONE — le portage du crochet du bureau
 * (`apps/web/src/trailerPreview/useTrailerPreview.ts`) sur le focus :
 *
 *   - la demande au serveur part à l'INTENTION (avant le délai choisi, jamais
 *     sous 450 ms de focus tenu : tv-core `tvTrailerPreviewTiming`) ; partie, elle va au bout même si
 *     le focus s'en va — sa réponse, gardée, sert le retour sur la carte ;
 *   - un refus passager (429, panne, délai) se redemande à son échéance si le
 *     focus tient, deux fois au plus ; un refus vaut « rien à montrer » ;
 *   - la vidéo se charge cachée et en pause ; elle paraît dans la zone au plus
 *     tôt au délai choisi (800 ms par défaut), et seulement avec sa première
 *     image ;
 *   - jouée sous le focus, Lecture/Pause la met en pause, et maintenue coupe
 *     son son (`usePreviewRemote`) ;
 *   - une vidéo qui lâche n'est pas redemandée de sitôt (mémoire de
 *     l'appareil) ; un seul aperçu à la fois (l'arbitre) ;
 *   - la session ne monte AUCUN lecteur : elle dit ce qu'elle veut au lecteur
 *     unique de la zone (`onVideo`), qui ne se démonte jamais entre deux
 *     titres — une rafale de flèches ne crée ni ne détruit aucun lecteur ;
 *   - app en arrière-plan, serveur sans `trailers.preview` : rien.
 *
 * Une session par titre (clée par son sujet), montée quand le focus a tenu.
 */
export const ZoneSession = memo(function ZoneSession({ sessionKey, subject, focused, since: focusedSince, onShown, onVideo }: ZoneSessionProps) {
  const { i18n } = useTranslation();
  const lang = uiLanguage(i18n.language);
  const { storage } = useTentacleConfig();
  const subjectKey = trailerPreviewSubjectKey(subject);
  // Le sujet n'a d'identité que par sa clé : un modèle reconstruit ne relance rien.
  const subjectRef = useRef(subject);
  if (trailerPreviewSubjectKey(subjectRef.current) !== subjectKey) subjectRef.current = subject;
  const stableSubject = subjectRef.current;

  const appActive = useAppActive();
  const [wantsStream, setWantsStream] = useState(false);
  const stream = useTrailerPreviewStream(stableSubject, lang, { enabled: wantsStream && !previewMemory.recentlyFailed(subjectKey) });
  const [state, dispatch] = useTvPreviewMachine(focused, !appActive || !stream.capable, subjectKey, focusedSince);
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
    previewArbiter.claim(holder, () => dispatch({ type: "preempted", at: Date.now() }));
    return () => previewArbiter.release(holder);
  }, [wants, holder, dispatch]);

  const current = cycleStream?.cycle === state.cycle ? cycleStream : null;
  // La vidéo que la machine monte (chargée cachée, montrée, ou dans sa sortie).
  const video = trailerPreviewMounted(state) ? current : null;
  const expanded = trailerPreviewVisible(state) && current !== null;
  // Lecture/Pause pendant l'aperçu : une vraie pause, rendue dès qu'il ne joue plus.
  const remotePaused = usePreviewRemote(expanded && focused);
  const playing = trailerPreviewPlaying(state) && video !== null && !remotePaused;
  // Le focus parti, la vidéo s'efface dans le rendu MÊME du flou, sans attendre la machine.
  const shown = expanded && focused;
  useEffect(() => onShown(sessionKey, shown), [sessionKey, shown, onShown]);

  // Un avis d'un cycle passé ne parle plus à la machine : elle vit déjà le suivant.
  const live = useRef(false);
  live.current = video !== null;
  // Une erreur n'est un échec du titre que si le focus est resté et que rien n'est venu la démentir
  // (tv-core `PREVIEW_VIDEO_ERROR_GRACE_MS`) : au départ du focus, ou celle de l'élément que la
  // reprise remplace (première image aussitôt), elle ne compte pas.
  const stillFocused = useRef(focused);
  stillFocused.current = focused;
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyAt = useRef(0);
  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
  }, []);
  // Prête dans la grâce (avant ou après l'erreur) : l'erreur était celle de l'élément remplacé.
  const onReady = useCallback(() => {
    readyAt.current = Date.now();
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = null;
    if (live.current) dispatch({ type: "videoReady", at: Date.now() });
  }, [dispatch]);
  const onError = useCallback(() => {
    if (!live.current || errorTimer.current || Date.now() - readyAt.current < PREVIEW_VIDEO_ERROR_GRACE_MS) return;
    errorTimer.current = setTimeout(() => {
      errorTimer.current = null;
      if (live.current && stillFocused.current) dispatch({ type: "videoFailed", at: Date.now() });
    }, PREVIEW_VIDEO_ERROR_GRACE_MS);
  }, [dispatch]);
  const videoKey = video?.videoKey;
  const onEnded = useCallback(() => {
    if (videoKey) previewMemory.forgetPosition(videoKey);
    if (live.current) dispatch({ type: "videoEnded", at: Date.now() });
  }, [dispatch, videoKey]);
  const onPosition = useCallback((position: number, duration: number) => {
    if (videoKey) previewMemory.savePosition(videoKey, position, duration > 0 ? duration : undefined);
  }, [videoKey]);

  const want = useMemo<ZoneVideoWant | null>(
    () => (video ? { uri: video.uri, hls: video.hls, startAt: video.startAt, playing, onReady, onError, onEnded, onPosition } : null),
    [video, playing, onReady, onError, onEnded, onPosition],
  );
  useEffect(() => onVideo(sessionKey, want), [sessionKey, want, onVideo]);
  useEffect(() => () => {
    onShown(sessionKey, false);
    onVideo(sessionKey, null);
  }, [sessionKey, onShown, onVideo]);
  return null;
});
