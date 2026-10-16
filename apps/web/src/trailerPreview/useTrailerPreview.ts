import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isTransientPreviewRefusal, previewRetryDelayMs, trailerPreviewResultTtl, useTrailerPreviewStream,
} from "@tentacle-tv/api-client";
import {
  TRAILER_PREVIEW_TIMING,
  trailerPreviewMounted,
  trailerPreviewPlaying,
  trailerPreviewSubjectKey,
  trailerPreviewVideoReady,
  trailerPreviewVisible,
  trailerPreviewWantsStream,
  uiLanguage,
  type TrailerPreviewSubject,
} from "@tentacle-tv/shared";
import { usePipSession } from "../pictureInPicture/pictureInPictureStore";
import { trailerPreviewArbiter } from "./previewArbiterInstance";
import { useTrailerPreviewBlock } from "./previewEnvironment";
import { rememberTrailerPreviewFailure, trailerPreviewRecentlyFailed } from "./previewFailures";
import { useTrailerPreviewMuted, useTrailerPreviewVolume } from "./previewSettings";
import { loadPreviewHls } from "./previewSource";
import { previewStreamOf } from "./previewStream";
import type { TrailerPreviewHandle, TrailerPreviewStream } from "./previewTypes";
import { usePreviewMachine } from "./usePreviewMachine";

/**
 * L'aperçu de bande-annonce d'UNE carte : quand demander, quand montrer.
 *
 * `hovered` : la carte (ou sa mini-carte) est survolée — à la souris ou au
 * clavier —, et rien ne l'a fermée. Le crochet rend ce que la mini-carte doit
 * faire (`mount`, `visible`, `videoProps`) ; il ne dessine rien.
 *
 *   - la demande part à l'INTENTION (`intentMs` de survol continu, pointeur
 *     arrêté), jamais au montage ni au simple passage de la souris ; partie,
 *     elle va au bout même si le survol cesse — sa réponse, gardée, sert le
 *     retour sur la carte (`useTrailerPreviewStream`) ;
 *   - la vidéo se charge cachée et en pause jusqu'à sa première image ;
 *   - la mini-carte se montre au plus tôt à `revealMs` (le délai choisi, cf.
 *     `previewDelay.ts`) et seulement si la vidéo est prête — ou si la
 *     mini-carte a l'image du titre (`reportStillReady`) : la bande-annonce
 *     est VÉRIFIÉE par le serveur, la vidéo rejoint l'image à sa première
 *     image (`videoReady`) ;
 *   - un refus du serveur, une erreur, un blocage : rien ne s'anime.
 *
 * Bloqué (aucune requête, rien à l'écran) : réglage coupé, serveur sans la
 * capacité `trailers.preview`, PiP en cours, hors ligne, page cachée, écran
 * tactile, miroir, économie de données (`previewEnvironment.ts`).
 */
export function useTrailerPreview(subject: TrailerPreviewSubject | null, hovered: boolean): TrailerPreviewHandle {
  const { i18n } = useTranslation();
  const lang = uiLanguage(i18n.language);
  const subjectKey = subject ? trailerPreviewSubjectKey(subject) : null;
  // Le sujet n'a d'identité que par sa clé : une carte qui le reconstruit à chaque rendu ne relance rien.
  const subjectRef = useRef(subject);
  if (subjectRef.current === null || subject === null || trailerPreviewSubjectKey(subjectRef.current) !== subjectKey) {
    subjectRef.current = subject;
  }
  const stableSubject = subjectRef.current;

  const environmentBlock = useTrailerPreviewBlock();
  const pipSession = usePipSession();
  // La capacité vient de la requête elle-même : un serveur d'avant n'est jamais interrogé.
  // Un titre dont la vidéo vient de lâcher ici n'est pas redemandé (`previewFailures.ts`) :
  // la requête ne s'active même pas, le temps que la machine le constate.
  const [wantsStream, setWantsStream] = useState(false);
  const enabled = wantsStream && !trailerPreviewRecentlyFailed(subjectKey);
  const stream = useTrailerPreviewStream(stableSubject, lang, { enabled });
  const blocked = environmentBlock !== null || pipSession !== null || !stream.capable || subjectKey === null;

  const [state, dispatch] = usePreviewMachine(hovered, blocked, subjectKey);
  const wants = trailerPreviewWantsStream(state);
  useEffect(() => setWantsStream(wants), [wants]);

  // La réponse du serveur, quand l'intention l'attend — jamais une réponse périmée
  // (jeton du relais échu, refus d'il y a une heure) : la requête la renouvelle.
  // Chaque réponse ne se lit qu'UNE fois par cycle (`consumed`, son instant) :
  // après un refus passager, seule une réponse plus récente compte. Le flux est
  // FIGÉ pour le cycle : une réponse qui vieillit pendant la lecture ne coupe rien.
  const { result, fresh, receivedAt, loading } = stream;
  const [cycleStream, setCycleStream] = useState<{ cycle: number; stream: TrailerPreviewStream } | null>(null);
  const consumed = useRef({ cycle: -1, at: 0 });
  useEffect(() => {
    if (state.phase !== "fetching" || state.retryAt !== null || loading) return;
    const at = Date.now();
    if (trailerPreviewRecentlyFailed(subjectKey, at)) {
      dispatch({ type: "streamMissing", at });
      return;
    }
    const seen = consumed.current.cycle === state.cycle ? consumed.current.at : 0;
    if (!result || receivedAt <= seen) return;
    if (!fresh) {
      // Arrivée pendant ce survol mais déjà échue (jeton du relais au bout) : on redemande, au lieu
      // de l'ignorer et d'attendre sans fin. Une réponse d'avant, périmée depuis, se renouvelle seule.
      if (receivedAt < (state.since ?? 0) || trailerPreviewResultTtl(result, receivedAt) > 0) return;
      consumed.current = { cycle: state.cycle, at: receivedAt };
      dispatch({ type: "streamRetry", at, retryAt: at + TRAILER_PREVIEW_TIMING.timeoutRetryMs });
      return;
    }
    consumed.current = { cycle: state.cycle, at: receivedAt };
    if (result.status === "found") {
      setCycleStream({ cycle: state.cycle, stream: previewStreamOf(result.preview) });
      dispatch({ type: "streamFound", at });
    } else if (isTransientPreviewRefusal(result)) {
      // 429, panne : on redemande à l'échéance que le refus porte, si le survol tient.
      dispatch({ type: "streamRetry", at, retryAt: receivedAt + previewRetryDelayMs(result, state.retries) });
    } else {
      dispatch({ type: "streamMissing", at });
    }
  }, [state.phase, state.cycle, state.since, state.retryAt, state.retries, result, fresh, receivedAt, loading, subjectKey, dispatch]);

  // L'échéance d'un refus passager est passée, le survol tient : nouvelle demande.
  const retryStream = stream.retry;
  useEffect(() => {
    if (state.attempt > 0) retryStream();
  }, [state.attempt, retryStream]);

  // Le lecteur se charge pendant que le serveur vérifie : la vidéo n'attendra pas hls.js.
  useEffect(() => {
    if (state.phase === "fetching") loadPreviewHls().catch(() => undefined);
  }, [state.phase]);

  // Le survol cesse avant la réponse : la demande n'est PAS abandonnée. Le
  // serveur la mène à son terme de toute façon, et sa réponse, gardée, sert le
  // retour sur la carte sans rien redemander (`useTrailerPreviewStream`).

  // Une vidéo qui a lâché ici (erreur fatale, première image trop lente) : la
  // réponse qui la désignait n'est plus crue — la prochaine intention redemande
  // au serveur. Lue FRAÎCHE pour ce survol, la vidéo n'est pas retentée de
  // sitôt ; GARDÉE d'un survol précédent, c'est la réponse qui est suspecte (un
  // jeton du relais mort avec un redémarrage du serveur) : pas de mémoire
  // d'échec, le survol suivant aura la réponse neuve.
  // Le titre de CHAQUE cycle est relevé à son début : l'échec se range sous le
  // titre qui l'a vécu, jamais sous celui qui le remplace au même rendu.
  const cycleTitle = useRef({ cycle: -1, key: null as string | null, forget: stream.forget });
  if (cycleTitle.current.cycle !== state.cycle) cycleTitle.current = { cycle: state.cycle, key: subjectKey, forget: stream.forget };
  const handledFailure = useRef(-1);
  const { since } = state;
  useEffect(() => {
    if (state.phase !== "failed" || state.failure !== "video" || handledFailure.current === state.cycle) return;
    const title = cycleTitle.current;
    if (title.cycle !== state.cycle || title.key === null) return;
    handledFailure.current = state.cycle;
    title.forget();
    const reused = consumed.current.cycle === state.cycle && since !== null && consumed.current.at < since;
    if (!reused) rememberTrailerPreviewFailure(title.key);
  }, [state.phase, state.failure, state.cycle, since]);

  // Un seul aperçu à la fois : la place se prend à la demande, se rend à la fin.
  const holder = useRef({}).current;
  useEffect(() => {
    if (!wants) return;
    trailerPreviewArbiter.claim(holder, () => dispatch({ type: "preempted", at: Date.now() }));
    return () => trailerPreviewArbiter.release(holder);
  }, [wants, holder, dispatch]);

  // Le son : coupé d'un geste (retenu sur l'appareil), ou refusé par le navigateur pour CE cycle.
  const [rememberedMuted, setRememberedMuted] = useTrailerPreviewMuted();
  const [soundBlockedCycle, setSoundBlockedCycle] = useState<number | null>(null);
  const muted = rememberedMuted || soundBlockedCycle === state.cycle;
  const toggleMute = useCallback(() => {
    if (muted) {
      setSoundBlockedCycle(null);
      setRememberedMuted(false);
    } else {
      setRememberedMuted(true);
    }
  }, [muted, setRememberedMuted]);
  // Le volume, réglé dans la mini-carte : le monter rend le son, le mettre à zéro le coupe.
  const [rememberedVolume, setRememberedVolume] = useTrailerPreviewVolume();
  const setVolume = useCallback((next: number) => {
    if (next > 0) {
      setRememberedVolume(next);
      setSoundBlockedCycle(null);
      setRememberedMuted(false);
    } else {
      setRememberedMuted(true);
    }
  }, [setRememberedVolume, setRememberedMuted]);

  const cycleRef = useRef(state.cycle);
  cycleRef.current = state.cycle;
  // Le rognage du letterbox, mesuré sur la première image : fixé AVEC elle (même rendu), par cycle.
  const [frameCrop, setFrameCrop] = useState({ cycle: -1, scale: 1 });
  const onReady = useCallback((frame?: { crop: number }) => {
    setFrameCrop({ cycle: cycleRef.current, scale: frame?.crop ?? 1 });
    dispatch({ type: "videoReady", at: Date.now() });
  }, [dispatch]);
  const reportStillReady = useCallback(() => dispatch({ type: "stillReady", at: Date.now() }), [dispatch]);
  const onFragment = useCallback(() => dispatch({ type: "videoFragment", at: Date.now() }), [dispatch]);
  const onError = useCallback(() => dispatch({ type: "videoFailed", at: Date.now() }), [dispatch]);
  const onEnded = useCallback(() => dispatch({ type: "videoEnded", at: Date.now() }), [dispatch]);
  const onSoundBlocked = useCallback(() => setSoundBlockedCycle(cycleRef.current), []);

  const streamValue = cycleStream?.cycle === state.cycle ? cycleStream.stream : null;
  const mount = trailerPreviewMounted(state) && streamValue !== null;
  const visible = trailerPreviewVisible(state) && streamValue !== null;
  const playing = trailerPreviewPlaying(state);
  const videoReady = trailerPreviewVideoReady(state);
  const videoCrop = frameCrop.cycle === state.cycle ? frameCrop.scale : 1;
  const volume = visible ? rememberedVolume : 0;

  const videoProps = useMemo(
    () => ({ stream: streamValue, muted, playing, volume, cycle: state.cycle, onReady, onFragment, onError, onEnded, onSoundBlocked }),
    [streamValue, muted, playing, volume, state.cycle, onReady, onFragment, onError, onEnded, onSoundBlocked],
  );

  return useMemo(
    () => ({
      phase: state.phase, mount, visible, videoReady, videoCrop, reportStillReady, playing, stream: streamValue, muted, toggleMute,
      soundVolume: rememberedVolume, setVolume,
      onReady, onError, onEnded, videoProps,
    }),
    [state.phase, mount, visible, videoReady, videoCrop, reportStillReady, playing, streamValue, muted, toggleMute, rememberedVolume, setVolume, onReady, onError, onEnded, videoProps],
  );
}
