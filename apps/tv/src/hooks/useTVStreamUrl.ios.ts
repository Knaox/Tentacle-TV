import { useEffect, useRef, useState } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { randomSessionId } from "../utils/playerHelpers";
import { NativeModules } from "react-native";
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
  }>({ baseUrl: null, isDirectPlay: true });

  // Lus au moment du fetch sans être des déclencheurs (le switch audio en direct
  // play est natif ; en transcode, c'est `startTicks` (captureReloadTicks) qui
  // déclenche le refetch et embarque l'audioIndex courant).
  const audioRef = useRef(audioIndex);
  audioRef.current = audioIndex;

  // Sous-titre à INCRUSTER (burn-in → transcode) : graphiques partout + ASS/SSA sur
  // tvOS. Les autres sous-titres texte passent en natif AVPlayer (aucun refetch).
  // Sur le remux tvOS, seules les IMAGES (PGS/VOBSUB) bloquent (→ burn-in serveur) ; le TEXTE passe
  // en overlay JS → ne bloque PAS la Lecture directe (isLocalRemux=true : ce hook .ios EST le remux).
  const burnInIndex = subtitleIndex != null && subtitleIndex >= 0
    && isBurnInSubtitleCodec(
      streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Codec, true,
    )
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
  // et le churn AVPlayer (cause du -16156 / fallback transcode).
  const remuxKeyRef = useRef("");
  const remuxUrlRef = useRef<string | null>(null);

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
    // écran de chargement plein écran (PlayerScreen).
    if (!softReload) setResult((r) => ({ ...r, baseUrl: null }));

    (async () => {
      try {
        // Lecteur local « façon Infuse » : contenu HEVC/H264 (souvent en MKV non
        // lisible par AVPlayer) → Jellyfin sert le fichier BRUT, on le remuxe en
        // MP4 fragmenté localement (FFmpeg, copie de flux) → Direct Play → badge
        // HDR/DV. Zéro transcodage serveur. Repli sur le flux Jellyfin si échec.
        const __vstream = streams.find((s) => s.Type === "Video");
        // DV profil 7 (double couche, rips disque/UHD) = mur tvOS (pas lu nativement) → NE PAS
        // remuxer, laisser Jellyfin replier en HDR10/transcode. P5/P8/HDR10/HLG/SDR → remux.
        const __isDvP7 = __vstream?.DvProfile === 7;
        const __remux = (NativeModules as { TVLocalRemux?: { start?: (u: string, dyn: number, aud: number, startSec: number) => Promise<string> } }).TVLocalRemux;

        // CHANTIER B — ne remuxer que si AVPlayer NE PEUT PAS faire de Direct Play NATIF (sinon
        // on matérialise un fichier sur disque pour rien : c'est l'« over-trigger 1080p »).
        // AVPlayer tvOS lit nativement : conteneurs MP4/M4V/MOV (PAS MKV/TS), HEVC hvc1 / H.264
        // avc1, audio AAC/AC3/EAC3/ALAC/FLAC/MP3/Opus, DV P5/P8 + HDR10/HLG. Murs tvOS → remux :
        //  (1) conteneur ≠ MP4/MOV/M4V (MKV/TS/AVI… : AVPlayer refuse le conteneur) ;
        //  (2) audio non décodable (DTS/DTS-HD/TrueHD/PCM/Vorbis… → le remux transcode en EAC3) ;
        //  (3) HDR/Dolby Vision : on GARDE le remux pour engager le badge via le HLS local +
        //      AVDisplayCriteria (raison d'être de la branche ; AVPlayer ne bascule pas toujours
        //      la sortie HDMI sur un MP4 progressif). hev1 est couvert par (1) : les hev1 viennent
        //      surtout de MKV/TS ; un rare hev1-in-MP4 → écran noir → fallback codec → transcode.
        // Sinon (MP4/MOV + hvc1/avc1 + audio OK + SDR) → Direct Play NATIF (PlaybackInfo, zéro disque).
        const __c = (container ?? "").toLowerCase();
        const __nativeContainer = /\b(mp4|m4v|mov|qt)\b/.test(__c);   // "mov,mp4,m4a,…" compte aussi
        const __aud = streams.find((s) => s.Type === "Audio" && s.Index === audioRef.current)
          ?? streams.find((s) => s.Type === "Audio");
        const __acodec = (__aud?.Codec ?? "").toLowerCase();
        const __audioOk = __acodec === "" || /^(aac|ac-?3|e-?ac-?3|ec-?3|alac|mp3|flac|opus)$/.test(__acodec);
        const __range = (__vstream?.VideoRangeType ?? "").toUpperCase();
        const __isHdrOrDv = (__vstream?.DvProfile ?? 0) > 0 || /HDR|PQ|HLG|DOVI|DOLBY/.test(__range);
        const __needRemux = !__nativeContainer || !__audioOk || __isHdrOrDv;
        if (!forceTranscode && !isTranscodingQuality && burnInIndex < 0 && !__isDvP7 && __remux?.start && __needRemux &&
            (vcodec === "hevc" || vcodec === "h265" || vcodec === "h264")) {
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
            // Idempotent : même contenu + même audio + même nonce déjà remuxé → réutiliser l'URL locale sans
            // relancer start(). Cache-buster `&r` : force AVPlayer à re-fetch le manifeste (anti-cache EVENT→VOD).
            if (remuxKeyRef.current === remuxKey && remuxUrlRef.current) {
              const busted = remuxUrlRef.current + (remuxUrlRef.current.includes("?") ? "&" : "?") + "r=" + (args.reloadNonce ?? 0);
              setResult({ baseUrl: busted, resumeFrag, isDirectPlay: true, isLocalRemux: true });
              return;
            }
            const rawUrl = client.getStreamUrl(itemId, { directPlay: true, mediaSourceId });
            // Plage dynamique AUTORITAIRE depuis Jellyfin (le natif ne lit pas la couleur si le MKV
            // n'a pas d'élément Colour) → badge correct. 1=SDR (force la redescente), 3=HDR10, 4=DV.
            const __range = (__vstream?.VideoRangeType ?? "").toUpperCase();
            const __isDV = (__vstream?.DvProfile ?? 0) > 0 || __range.includes("DOVI") || __range.includes("DOLBY");
            // videoDynamicRange empirique tvOS 18 (vérifié device) : Dolby Vision=3, HDR10/HLG=4, SDR=1.
            const __dyn = __isDV ? 3 : (__range.includes("HDR") || __range.includes("PQ") || __range.includes("HLG")) ? 4 : 1;
            // Retry : le 1ᵉʳ segment HLS peut être long (~10 s, coupé au keyframe) → start() peut
            // échouer/timeouter au 1ᵉʳ play à froid. On réessaie AVANT de retomber en transcode
            // (sinon on perd le HDR/DV). Le 2ᵉ essai trouve la session chaude (segment en cache).
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const localUrl = await __remux.start(rawUrl, __dyn, audioRef.current, Math.floor(startSeconds ?? 0));
                if (fetchIdRef.current !== fetchId) return;
                if (localUrl) {
                  remuxKeyRef.current = remuxKey;
                  remuxUrlRef.current = localUrl;
                  setResult({ baseUrl: localUrl, resumeFrag, isDirectPlay: true, isLocalRemux: true });
                  return;
                }
              } catch {
                if (fetchIdRef.current !== fetchId) return;
                if (attempt < 2) await new Promise((r) => setTimeout(r, 600));
              }
            }
            // tous les essais ont échoué → repli silencieux sur PlaybackInfo (transcode/direct serveur)
          } catch { /* repli PlaybackInfo */ }
        }

        // Un preset de qualité OU un fallback codec force le transcode (DirectPlayProfiles vidés).
        const cap = isTranscodingQuality && maxBitrate ? maxBitrate : undefined;
        // burnInIndex >= 0 ⇒ sous-titre ASS/SSA sélectionné : profil sans livraison
        // texte → le serveur INCRUSTE ce sous-titre (sinon il convertirait en VTT
        // avec balises {\an8} qui fuient).
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
        if (!ms) { setResult({ baseUrl: null, isDirectPlay: false }); return; }

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
        setResult({ baseUrl: null, isDirectPlay: false });
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

  return { streamUrl, playSessionId: result.playSessionId, isDirectPlay: result.isDirectPlay, isLocalRemux: result.isLocalRemux };
}
