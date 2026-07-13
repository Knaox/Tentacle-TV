import { useEffect, useRef, useState } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { randomSessionId } from "../utils/playerHelpers";
import { remuxEligible, startLocalRemux, TVRemux } from "../utils/tvLocalRemuxStart";
import { buildTvosDeviceProfile } from "../lib/tvosDeviceProfile";
import { getHdrCapabilities } from "../lib/hdrCapabilities";

/**
 * Variante tvOS de `useTVStreamUrl` (résolue par Metro sur iOS ; Android garde
 * `useTVStreamUrl.ts` intact). Pilotée par `POST PlaybackInfo` + DeviceProfile
 * AVPlayer : le SERVEUR décide DirectPlay / transcode (DirectStream remux,
 * re-encode…), ce qui maximise les formats lisibles par Apple TV et évite
 * l'écran noir des MKV.
 *
 * IMPORTANT : l'URL est construite via `client.getStreamUrl()` (et NON à la main)
 * afin de passer par `resolveMediaUrl` (réécriture proxy same-origin → host de
 * streaming) et l'auth — sinon AVPlayer est rejeté par le proxy (NSURL -1013).
 * Seule la DÉCISION direct/transcode vient de PlaybackInfo ; la fabrication de
 * l'URL est identique à Android.
 *
 * Timeline ABSOLUE (comme Android) : position de reprise via le fragment
 * `#tnt-start=` lu par `AVPlayerSurface` (seek client au onLoad).
 */
export function useTVStreamUrl(args: {
  itemId: string;
  mediaSourceId?: string;
  /** Conteneur Jellyfin (mp4/mkv/mov/ts…) — gate le remux : MP4/MOV/M4V = Direct Play natif. */
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
}) {
  const {
    itemId, mediaSourceId, container, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight,
  } = args;
  const client = useJellyfinClient();
  const userId = useUserId();

  // URL de BASE + fragment de reprise `#tnt-start` CUITS ENSEMBLE (atomiques). Le
  // fragment N'EST PLUS dérivé live du `startSeconds` courant : il était décorrélé
  // de `baseUrl` (async), d'où un DOUBLE reload au changement d'audio (le fragment
  // changeait SYNCHRONE via startTicks pendant que baseUrl attendait le re-remux →
  // 1er reload ancien flux + nouvelle position, 2e reload nouveau flux). En le
  // figeant dans `result` au moment de l'émission, `streamUrl` ne change qu'UNE
  // fois par reload. L'effet se ré-exécute déjà sur `vcodec` (cold start, où
  // `startSeconds` devient connu en même temps) et `startTicks` (reload de piste/
  // qualité, où captureReloadTicks a posé la position courante) → le fragment cuit
  // reflète toujours la bonne position de reprise au montage du player.
  const [result, setResult] = useState<{
    baseUrl: string | null;
    resumeFrag?: string;
    playSessionId?: string;
    isDirectPlay: boolean;
    isLocalRemux?: boolean;
    /** Résolution du flux ÉCHOUÉE (remux + PlaybackInfo) : l'écran de chargement
     *  affiche une erreur + « Réessayer » au lieu de tourner pour toujours. */
    failed?: boolean;
  }>({ baseUrl: null, isDirectPlay: true });

  // Lus au moment du fetch sans être des déclencheurs (le switch audio en direct
  // play est natif ; en transcode, c'est `startTicks` (captureReloadTicks) qui
  // déclenche le refetch et embarque l'audioIndex courant).
  const audioRef = useRef(audioIndex);
  audioRef.current = audioIndex;

  // Sous-titre à INCRUSTER (burn-in → transcode) : IMAGES uniquement (PGS/VOBSUB/DVB).
  // Tout sous-titre TEXTE est rendu par l'overlay JS (remux, direct play, transcode)
  // → ne bloque jamais la lecture directe et ne déclenche aucun refetch.
  const burnInIndex = subtitleIndex != null && subtitleIndex >= 0
    && isBurnInSubtitleCodec(streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Codec)
    ? subtitleIndex
    : -1;

  // Codec vidéo dérivé AU NIVEAU DU HOOK → AJOUTÉ aux deps du useEffect. `streams` charge en
  // ASYNC (react-query `useMediaItem`) : au 1ᵉʳ rendu il est VIDE → sans cette dép, la décision
  // remux resterait figée sur cet état vide (codec undefined → transcode persistant au 1ᵉʳ play
  // après démarrage app et au switch de média). Avec la dép, on re-décide dès le codec connu.
  const vcodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();
  // Position de reprise ARRONDIE → ajoutée aux deps de l'effet : si la reprise se RAFRAÎCHIT avant le
  // démarrage (item périmé venu du cache média-détail puis re-fetché), l'URL/le remux se reconstruit à la
  // BONNE position (parité avec un lancement depuis l'accueil). Stable pendant la lecture (figée).
  const resumeSec = Math.max(0, Math.floor(startSeconds ?? 0));

  const fetchIdRef = useRef(0);
  // Bascule ERREUR → transcode (fallback codec/-19601) : reload « dur » forcé, même contenu.
  // Sans ça le reload serait « doux » (même contentKey) → le player resterait gelé sur le flux
  // remux MORT pendant le fetch PlaybackInfo ; avec, baseUrl=null → TVPlayerLoadingScreen
  // (le bel écran de chargement) s'affiche jusqu'au démarrage du transcode.
  const prevFTRef = useRef(forceTranscode);
  // Clé de CONTENU : ne change qu'au changement d'item/source (≠ changement de
  // piste/qualité). Permet de distinguer un reload « dur » (nouveau contenu →
  // écran de chargement) d'un reload « doux » (audio/qualité → on GARDE l'ancienne
  // URL pour ne pas démonter le player ; juste un re-buffer discret).
  const contentKeyRef = useRef("");
  // Idempotence remux : ne relancer le remux que si le CONTENU change (≠ reprise/
  // piste/qualité qui re-déclenchent l'effet) → évite plusieurs serveurs locaux
  // et le churn AVPlayer (cause du -16156 / fallback transcode). Le frag exact
  // (origine réelle de session) est caché AVEC l'URL pour rester cohérent.
  const remuxCacheRef = useRef<{ key: string; url: string; frag: string } | null>(null);
  // Jeton de session natif (gen) : cancel() au démontage n'annule que SA session.
  const remuxGenRef = useRef(0);

  // Démontage du player : annuler la session remux native — sans ça le producteur
  // FFmpeg restait garé dans sa boucle de pacing (thread bloqué) et jusqu'à 1,6 Go
  // de segments traînaient sur disque jusqu'au prochain start(). Gen-gardé côté
  // natif : le start() du prochain écran (replace épisode suivant) a déjà bumpé
  // gGen → le cancel de l'ancien écran est un no-op. Bump de fetchIdRef : les
  // fetchs en vol ne setState plus après démontage.
  useEffect(() => () => {
    fetchIdRef.current++;
    if (remuxGenRef.current > 0) TVRemux?.cancel?.(remuxGenRef.current);
  }, []);

  useEffect(() => {
    if (!itemId || !userId) return;
    const fetchId = ++fetchIdRef.current;
    const contentKey = `${itemId}|${mediaSourceId ?? ""}`;
    const ftJustEnabled = forceTranscode && !prevFTRef.current;
    prevFTRef.current = forceTranscode;
    const softReload = contentKeyRef.current === contentKey && !ftJustEnabled;
    contentKeyRef.current = contentKey;
    // Fragment de reprise figé pour CETTE émission (cf. result.resumeFrag). Lu sur
    // le `startSeconds` du rendu qui a déclenché l'effet (startTicks/vcodec) → la
    // bonne position de reprise, cuite atomiquement avec baseUrl.
    const resumeFrag = (startSeconds ?? 0) > 1 ? `#tnt-start=${Math.floor(startSeconds ?? 0)}` : "";
    // Reload doux (même contenu) : conserver l'URL courante jusqu'à la nouvelle
    // (le player reste monté, dernière image visible). Reload dur : null →
    // écran de chargement plein écran (PlayerScreen). Toute nouvelle tentative
    // (retry par bump de reloadNonce inclus) efface l'état d'échec.
    if (!softReload) setResult((r) => ({ ...r, baseUrl: null, failed: false }));
    else setResult((r) => (r.failed ? { ...r, failed: false } : r));

    (async () => {
      try {
        // Lecteur local « façon Infuse » : contenu HEVC/H264 (souvent en MKV non
        // lisible par AVPlayer) → Jellyfin sert le fichier BRUT, on le remuxe en
        // MP4 fragmenté localement (FFmpeg, copie de flux) → Direct Play → badge
        // HDR/DV. Zéro transcodage serveur. Repli sur le flux Jellyfin si échec.
        // Décision + start natif (retries) : cf. utils/tvLocalRemuxStart.ts.
        if (remuxEligible({
          container, streams, audioIndex: audioRef.current, vcodec,
          forceTranscode, isTranscodingQuality, burnInIndex,
        })) {
          try {
            // Clé incluant la PISTE AUDIO (changement de langue → re-remux : AVPlayer ne commute pas
            // le multi-audio HLS) ET la position de SESSION (startSeconds) : un SEEK lointain (JS pose
            // un nouveau startTicks → startSeconds) force un re-remux d'une nouvelle session depuis T
            // (av_seek_frame natif → gros sauts/reprise rapides). Le natif arbitre (withinAvail) si la
            // position est en réalité déjà disponible → réutilise alors la session courante.
            // `|n<reloadNonce>` : une reprise après pause longue (useTVRemuxPause) bump le nonce → BUST de la
            // clé → start() est rappelé (consomme gResumePending → nouvelle session à P), au lieu du
            // court-circuit de réutilisation qui renverrait l'URL de l'ancienne session (offset faux).
            const remuxKey = contentKey + "|a" + audioRef.current + "|t" + Math.floor(startSeconds ?? 0) + "|n" + (args.reloadNonce ?? 0);
            // Idempotent : même contenu + même audio + même nonce déjà remuxé → réutiliser l'URL locale
            // (ET son frag d'origine exact) sans relancer start(). Cache-buster `&r` : force AVPlayer à
            // re-fetch le manifeste (anti-cache EVENT→VOD).
            const cached = remuxCacheRef.current;
            if (cached && cached.key === remuxKey) {
              const busted = cached.url + (cached.url.includes("?") ? "&" : "?") + "r=" + (args.reloadNonce ?? 0);
              setResult({ baseUrl: busted, resumeFrag: cached.frag, isDirectPlay: true, isLocalRemux: true });
              return;
            }
            const rawUrl = client.getStreamUrl(itemId, { directPlay: true, mediaSourceId });
            const res = await startLocalRemux({
              rawUrl, streams, audioIndex: audioRef.current, startSeconds: startSeconds ?? 0,
              isCancelled: () => fetchIdRef.current !== fetchId,
            });
            if (fetchIdRef.current !== fetchId) return;
            if (res) {
              // Frag = origine RÉELLE de la timeline de session (keyframe ≤ T, renvoyée par le
              // natif) → l'offset absolu⇄relatif d'AVPlayerSurface est EXACT (fini le skew d'un
              // GOP sur scrubber/sous-titres/+30 après un gros saut ou une reprise).
              const frag = res.actualStartSec > 0.5 ? `#tnt-start=${res.actualStartSec.toFixed(2)}` : "";
              remuxCacheRef.current = { key: remuxKey, url: res.url, frag };
              remuxGenRef.current = res.gen;
              setResult({ baseUrl: res.url, resumeFrag: frag, isDirectPlay: true, isLocalRemux: true });
              return;
            }
            // tous les essais ont échoué → repli silencieux sur PlaybackInfo (transcode/direct serveur)
          } catch { /* repli PlaybackInfo */ }
        }

        // Un preset de qualité OU un fallback codec force le transcode (DirectPlayProfiles vidés).
        const cap = isTranscodingQuality && maxBitrate ? maxBitrate : undefined;
        // burnInIndex >= 0 ⇒ sous-titre IMAGE (PGS/VOBSUB) sélectionné : profil sans
        // livraison texte → le serveur INCRUSTE ce sous-titre. Le texte (ASS inclus)
        // n'incruste plus jamais : l'overlay JS interprète le VTT (parser partagé).
        // Capacités de décodage HDR/DV de cette Apple TV (module natif, mis en
        // cache) → gate le VideoRangeType du profil pour préserver un vrai signal
        // HDR/Dolby Vision (remux) au lieu d'un tone-mapping serveur vers SDR.
        const hdr = await getHdrCapabilities();
        const profile = buildTvosDeviceProfile(cap, forceTranscode || isTranscodingQuality, burnInIndex >= 0, hdr);

        const info = await client.getPlaybackInfo(itemId, {
          userId, deviceProfile: profile, mediaSourceId,
          audioStreamIndex: audioRef.current,
          subtitleStreamIndex: burnInIndex >= 0 ? burnInIndex : undefined,
          startTimeTicks: 0, // timeline absolue (reprise via #tnt-start)
          maxStreamingBitrate: cap,
          maxHeight: isTranscodingQuality && maxHeight ? maxHeight : undefined,
        });
        if (fetchIdRef.current !== fetchId) return;

        const ms = info.MediaSources?.[0];
        if (!ms) { setResult({ baseUrl: null, isDirectPlay: false, failed: true }); return; }

        const directPlay = !!ms.SupportsDirectPlay && !ms.TranscodingUrl;
        const sub = burnInIndex >= 0 ? burnInIndex : undefined;
        // playSessionId stable en transcode (suivi), inutile en direct play.
        const playSessionId = directPlay ? undefined : (info.PlaySessionId ?? randomSessionId());

        // URL via getStreamUrl → resolveMediaUrl + auth corrects (clé du fix -1013).
        let streamUrl: string;
        if (directPlay) {
          streamUrl = client.getStreamUrl(itemId, { directPlay: true, mediaSourceId });
        } else if (isTranscodingQuality && maxBitrate) {
          streamUrl = client.getStreamUrl(itemId, {
            directPlay: false, maxBitrate, maxHeight,
            audioIndex: audioRef.current, subtitleStreamIndex: sub, burnInSubtitle: burnInIndex >= 0, playSessionId, mediaSourceId,
          });
        } else {
          // Remux / fallback codec : HLS 8 Mbps (parité avec le fallback Android).
          streamUrl = client.getStreamUrl(itemId, {
            directPlay: false, maxBitrate: 8_000_000,
            audioIndex: audioRef.current, subtitleStreamIndex: sub, burnInSubtitle: burnInIndex >= 0, playSessionId, mediaSourceId,
          });
        }

        // Fragment de reprise CUIT avec la baseUrl (atomique → un seul reload).
        setResult({ baseUrl: streamUrl, resumeFrag, playSessionId, isDirectPlay: directPlay });
      } catch {
        if (fetchIdRef.current !== fetchId) return;
        // Échec TOTAL (remux + PlaybackInfo) : surfacer au lieu de laisser l'écran de
        // chargement tourner pour toujours (baseUrl null silencieux).
        setResult({ baseUrl: null, isDirectPlay: false, failed: true });
      }
    })();
    // startTicks = déclencheur de reload (reprise/piste/qualité). audioIndex est lu
    // via ref ; startSeconds est lu via la closure du rendu courant (les deps qui
    // déclenchent l'effet — startTicks/vcodec — coïncident avec sa bonne valeur),
    // puis cuit dans resumeFrag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mediaSourceId, container, userId, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, startTicks, resumeSec, burnInIndex, args.reloadNonce, vcodec]);

  // `streamUrl` = baseUrl + fragment de reprise, TOUS DEUX cuits ensemble dans
  // `result` (cf. plus haut) → change exactement une fois par reload (plus de
  // double rechargement audio). Le fragment `#tnt-start` est lu par AVPlayerSurface
  // (seek client). Pour le remux, le natif gate aussi la reprise (gWrittenSec ≥
  // gWantStartSec) pour ne pas résoudre sur un offset pas encore écrit (anti -16156).
  const streamUrl = result.baseUrl != null
    ? result.baseUrl + (result.resumeFrag ?? "")
    : null;

  return {
    streamUrl, playSessionId: result.playSessionId,
    isDirectPlay: result.isDirectPlay, isLocalRemux: result.isLocalRemux,
    failed: result.failed ?? false,
  };
}
