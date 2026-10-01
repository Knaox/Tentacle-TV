import { useEffect, useRef, useState } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { plog } from "../utils/playerDiag";
import {
  fallbackMuxedPrismCore, preferredAudioLanguageOf, prismEligible, prismHeaders, startPrismCore, stopPrismCore,
  type PrismStart,
} from "../utils/prismCoreStart";
import { resolveServerStream } from "../utils/tvosServerStream";
import { withRestartMark, type RestartOutcome } from "./streamRestart";

/**
 * Variante tvOS de `useTVStreamUrl` (résolue par Metro sur iOS ; Android garde
 * `useTVStreamUrl.ts`). Deux chemins, dans cet ordre :
 *  1. PrismCore (utils/prismCoreStart.ts) — lecture DIRECTE des HEVC/H.264 que
 *     AVPlayer ne sait pas ouvrir tel quel (MKV/TS, DTS/TrueHD, HDR/DV) : HLS
 *     local VOD, multi-audio natif, badge HDR/DV programmé avant le chargement ;
 *  2. sinon, ou en cas de refus, le chemin SERVEUR (`utils/tvosServerStream.ts`) :
 *     PlaybackInfo, le serveur décide DirectPlay / transcode.
 *
 * Timeline ABSOLUE (comme Android) : position de reprise via le fragment
 * `#tnt-start=` lu par `AVPlayerSurface` (seek client au onLoad).
 */
interface StreamResult {
  baseUrl: string | null;
  resumeFrag?: string;
  playSessionId?: string;
  isDirectPlay: boolean;
  /** Lecture directe servie par PrismCore (HLS local, timeline absolue). */
  isPrismCore?: boolean;
  /** Ce que PrismCore a rendu au démarrage (pistes transportées, renditions…). */
  prism?: PrismStart;
  /** Résolution du flux ÉCHOUÉE : l'écran de chargement affiche une erreur +
   *  « Réessayer » au lieu de tourner pour toujours. */
  failed?: boolean;
}

const fragmentAt = (sec: number) => (sec > 1 ? `#tnt-start=${Math.floor(sec)}` : "");
/** Une session remplacée par une relance s'arrête après ce délai : AVPlayer a
 *  alors quitté son item (un arrêt immédiat ferait échouer l'item sortant). */
const RETIRE_DELAY_MS = 3_000;

export function useTVStreamUrl(args: {
  itemId: string;
  mediaSourceId?: string;
  /** Conteneur Jellyfin (mp4/mkv/mov/ts…) — gate PrismCore : MP4/MOV/M4V = Direct Play natif. */
  container?: string;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex?: number;
  startTicks: number;
  startSeconds?: number;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  maxBitrate?: number;
  maxHeight?: number;
  isDirectPlay: boolean;
  /** Compteur de reload explicite (transcode) : changement de piste audio non
   *  couplé à la position. Le bumper force un refetch PlaybackInfo. */
  reloadNonce?: number;
  /** La fiche complète est là (ou a échoué) : rien ne se résout avant — voir
   *  `usePlayerStreamPipeline`. */
  ready: boolean;
}) {
  const {
    itemId, mediaSourceId, container, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, ready,
  } = args;
  const client = useJellyfinClient();
  const userId = useUserId();

  // URL de BASE + fragment de reprise `#tnt-start` CUITS ENSEMBLE (atomiques). Le
  // fragment N'EST PAS dérivé live du `startSeconds` courant : décorrélé de
  // `baseUrl` (async), il provoquait un DOUBLE reload au changement d'audio. Figé
  // dans `result` à l'émission, `streamUrl` ne change qu'UNE fois par reload.
  const [result, setResult] = useState<StreamResult>({ baseUrl: null, isDirectPlay: true });

  // Lus au moment du fetch sans être des déclencheurs (le switch audio en direct
  // play est natif ; en transcode, c'est `startTicks` (captureReloadTicks) qui
  // déclenche le refetch et embarque l'audioIndex courant).
  const audioRef = useRef(audioIndex);
  audioRef.current = audioIndex;

  // Sous-titre à INCRUSTER (burn-in → transcode) : IMAGES uniquement (PGS/VOBSUB/DVB).
  // Tout sous-titre TEXTE est rendu par l'overlay JS (direct play, transcode)
  // → ne bloque jamais la lecture directe et ne déclenche aucun refetch.
  const burnInIndex = subtitleIndex != null && subtitleIndex >= 0
    && isBurnInSubtitleCodec(streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Codec)
    ? subtitleIndex
    : -1;

  // Codec vidéo dérivé AU NIVEAU DU HOOK → dans les deps de l'effet : on
  // re-décide dès le codec connu.
  const vcodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();
  // Position de reprise ARRONDIE → dans les deps : une reprise RAFRAÎCHIE avant le
  // démarrage (item périmé venu du cache média-détail puis re-fetché) reconstruit
  // l'URL à la BONNE position. Stable pendant la lecture (figée).
  const resumeSec = Math.max(0, Math.floor(startSeconds ?? 0));

  const fetchIdRef = useRef(0);
  // Bascule ERREUR → transcode (fallback codec) : reload « dur » forcé, même contenu
  // — sinon le player resterait gelé sur le flux MORT pendant le PlaybackInfo.
  const prevFTRef = useRef(forceTranscode);
  // Clé de CONTENU : ne change qu'au changement d'item/source (≠ piste/qualité) —
  // reload « dur » (nouveau contenu → écran de chargement) ou « doux » (on GARDE
  // l'ancienne URL : le player reste monté, juste un re-buffer discret).
  const contentKeyRef = useRef("");
  // Session PrismCore courante : clé = CONTENU seul. Le changement de piste audio
  // est natif, la position est absolue → un seul start() par titre, réutilisé à
  // chaque ré-exécution de l'effet. Seule la RELANCE en ouvre une neuve.
  const prismCacheRef = useRef<{ key: string; start: PrismStart } | null>(null);
  // Jeton de session natif (gen) : stop() au démontage n'arrête que LA nôtre.
  const prismGenRef = useRef(0);
  const dropPrismSession = () => {
    stopPrismCore(prismGenRef.current);
    prismGenRef.current = 0;
    prismCacheRef.current = null;
  };
  // Sessions remplacées par une relance, arrêtées après RETIRE_DELAY_MS.
  const retiredRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const retire = (gen: number) => {
    retiredRef.current.set(gen, setTimeout(() => { retiredRef.current.delete(gen); stopPrismCore(gen); }, RETIRE_DELAY_MS));
  };

  // Démontage du player : les fetchs en vol ne setState plus, les sessions
  // PrismCore s'arrêtent (le start() de l'écran suivant a déjà sa propre gen).
  useEffect(() => () => {
    fetchIdRef.current++;
    dropPrismSession();
    for (const [gen, timer] of retiredRef.current) { clearTimeout(timer); stopPrismCore(gen); }
    retiredRef.current.clear();
  }, []);

  // Piste audio EFFECTIVE. `audioIndex` démarre à 0 (= flux vidéo) et son
  // alignement sur le défaut est un setState ASYNCHRONE : un index qui ne pointe
  // pas une piste audio réelle se résout ici au MÊME défaut que l'UI (IsDefault
  // puis première) — sinon le serveur retombait sur la PREMIÈRE piste du fichier.
  const effectiveAudio = (): number => {
    const audios = streams.filter((s) => s.Type === "Audio");
    const eff = audios.some((s) => s.Index === audioRef.current)
      ? audioRef.current
      : (audios.find((s) => s.IsDefault)?.Index ?? audios[0]?.Index ?? audioRef.current);
    if (eff !== audioRef.current) plog("stream", `audioIndex ${audioRef.current} invalide → défaut résolu ${eff}`);
    return eff;
  };

  /**
   * PrismCore d'abord, sinon le serveur. `fresh` (relance) : jamais la session
   * en cache, et la précédente n'est retirée qu'une fois la nouvelle prête ;
   * `keepShape` : un refus de PrismCore ne bascule pas sur le serveur. `null` :
   * pas de source, ou résolution supplantée. Lève sur une erreur réseau.
   */
  const resolve = async (a: {
    fetchId: number; contentKey: string; startSec: number; fresh: boolean; keepShape?: boolean; mark?: number;
  }): Promise<StreamResult | null> => {
    const effAudio = effectiveAudio();
    const resumeFrag = fragmentAt(a.startSec);
    if (prismEligible({ container, streams, audioIndex: effAudio, vcodec, forceTranscode, isTranscodingQuality })) {
      const cached = prismCacheRef.current;
      if (!a.fresh && cached && cached.key === a.contentKey) {
        plog("prism", "session en cache réutilisée");
        return { baseUrl: cached.start.url, resumeFrag, isDirectPlay: true, isPrismCore: true, prism: cached.start };
      }
      // Une session d'un AUTRE titre traîne encore (changement de source sans
      // démontage) : on la stoppe avant d'en ouvrir une nouvelle.
      const previousGen = prismGenRef.current;
      if (!a.fresh && previousGen > 0) dropPrismSession();
      plog("prism", `éligible → start(audio=${effAudio}, t=${Math.floor(a.startSec)}s)${a.fresh ? " — relance" : ""}`);
      const start = await startPrismCore({
        rawUrl: client.getStreamUrl(itemId, { directPlay: true, mediaSourceId }),
        headers: prismHeaders(client),
        preferredAudioLanguage: preferredAudioLanguageOf(streams, effAudio),
        isCancelled: () => fetchIdRef.current !== a.fetchId,
      });
      if (fetchIdRef.current !== a.fetchId) return null;
      if (start) {
        if (a.fresh && previousGen > 0 && previousGen !== start.gen) retire(previousGen);
        prismCacheRef.current = { key: a.contentKey, start };
        prismGenRef.current = start.gen;
        return { baseUrl: start.url, resumeFrag, isDirectPlay: true, isPrismCore: true, prism: start };
      }
      if (a.keepShape) return null;
      plog("prism", "refusé → repli PlaybackInfo serveur");
    } else if (prismGenRef.current > 0) {
      // Plus éligible (transcode forcé par une erreur codec, palier de qualité
      // transcodé) : la session ne sert plus à rien, on la libère.
      dropPrismSession();
    }
    const server = await resolveServerStream({
      client, userId: userId ?? "", itemId, mediaSourceId, audioIndex: effAudio, burnInIndex,
      forceTranscode, isTranscodingQuality, maxBitrate, maxHeight,
    });
    if (!server) return null;
    return {
      baseUrl: withRestartMark(server.url, a.mark ?? 0), resumeFrag,
      playSessionId: server.playSessionId, isDirectPlay: server.isDirectPlay,
    };
  };

  useEffect(() => {
    if (!itemId || !userId || !ready) return;
    const fetchId = ++fetchIdRef.current;
    const contentKey = `${itemId}|${mediaSourceId ?? ""}`;
    const ftJustEnabled = forceTranscode && !prevFTRef.current;
    prevFTRef.current = forceTranscode;
    const softReload = contentKeyRef.current === contentKey && !ftJustEnabled;
    contentKeyRef.current = contentKey;
    // Reload doux (même contenu) : conserver l'URL courante jusqu'à la nouvelle
    // (le player reste monté, dernière image visible). Reload dur : null →
    // écran de chargement plein écran. Toute nouvelle tentative (retry par bump
    // de reloadNonce inclus) efface l'état d'échec.
    if (!softReload) setResult((r) => ({ ...r, baseUrl: null, failed: false }));
    else setResult((r) => (r.failed ? { ...r, failed: false } : r));

    (async () => {
      try {
        // Le fragment est lu sur le `startSeconds` du rendu qui a déclenché
        // l'effet (startTicks/vcodec/resumeSec) puis cuit avec baseUrl.
        const next = await resolve({ fetchId, contentKey, startSec: startSeconds ?? 0, fresh: false });
        if (fetchIdRef.current !== fetchId) return;
        // Pas de source : surfacer au lieu de laisser tourner pour toujours.
        setResult(next ?? { baseUrl: null, isDirectPlay: false, failed: true });
      } catch {
        if (fetchIdRef.current !== fetchId) return;
        plog("stream", "résolution du flux ÉCHOUÉE (PlaybackInfo) → écran d'erreur");
        setResult({ baseUrl: null, isDirectPlay: false, failed: true });
      }
    })();
    // startTicks = déclencheur de reload (reprise/piste/qualité). audioIndex est lu
    // via ref ; startSeconds via la closure du rendu courant, puis cuit dans resumeFrag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mediaSourceId, container, userId, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, startTicks, resumeSec, burnInIndex, args.reloadNonce, vcodec, ready]);

  // `streamUrl` = baseUrl + fragment de reprise, cuits ensemble dans `result` :
  // change exactement une fois par reload.
  const streamUrl = result.baseUrl != null
    ? result.baseUrl + (result.resumeFrag ?? "")
    : null;

  // Master refusé par AVPlayer (-11868 / -11848 / -1002 — « Adapter la plage
  // dynamique » coupé sur un panneau HDR) : la même session rejouée en forme
  // muxée (une piste audio, sans renditions), à la position courante. Rend
  // false si PrismCore ne peut plus (successeur déjà minté, session stoppée) :
  // le caller replie alors sur PlaybackInfo en forçant le transcode.
  const retryMuxed = async (positionSec: number): Promise<boolean> => {
    const gen = prismGenRef.current;
    if (gen <= 0) return false;
    const start = await fallbackMuxedPrismCore(gen);
    if (!start) return false;
    prismGenRef.current = start.gen;
    prismCacheRef.current = { key: contentKeyRef.current, start };
    setResult({ baseUrl: start.url, resumeFrag: fragmentAt(positionSec), isDirectPlay: true, isPrismCore: true, prism: start });
    return true;
  };

  // Relance (contrat : `streamRestart.ts`) : la même source rouverte à `at`, sous
  // la même forme. Un échec laisse tout en place, sans écran d'erreur.
  const restartingRef = useRef(false);
  const restartMarkRef = useRef(0);
  const restart = async (at: number): Promise<RestartOutcome> => {
    if (restartingRef.current) return "busy";
    if (!itemId || !userId || !ready || !contentKeyRef.current) return "failed";
    restartingRef.current = true;
    const fetchId = ++fetchIdRef.current;
    try {
      const next = await resolve({
        fetchId, contentKey: contentKeyRef.current, startSec: at, fresh: true,
        keepShape: !!result.isPrismCore, mark: ++restartMarkRef.current,
      });
      // Supplantée par une résolution plus récente : c'est elle qui émet.
      if (fetchIdRef.current !== fetchId) return "ok";
      if (!next) return "failed";
      setResult(next);
      return "ok";
    } catch {
      return "failed";
    } finally {
      restartingRef.current = false;
    }
  };

  return {
    streamUrl, playSessionId: result.playSessionId,
    isDirectPlay: result.isDirectPlay, isPrismCore: result.isPrismCore ?? false, prism: result.prism,
    failed: result.failed ?? false, retryMuxed, restart,
  };
}
