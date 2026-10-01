import { NativeModules } from "react-native";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { nativePlayerHeaders } from "./nativePlayerHeaders";
import { plog } from "./playerDiag";

/**
 * Lecture directe par PrismCore (tvOS) — décision d'éligibilité + démarrage
 * de session via le module natif `PrismBridge`. PrismCore démuxe la source
 * Jellyfin, la remuxe en HLS-fMP4 (playlists VOD complètes, timeline absolue,
 * vrai multi-audio AVPlayer, Dolby Vision 7 → 8.1, Atmos préservé) et la sert
 * sur 127.0.0.1. Android : le module est absent → tout est inerte.
 */

/** Une piste audio de la source, vue par PrismCore. `delivery` :
 *  `streamCopy` / `bridged` (EAC3) / `unavailable` (ni copiable ni pontée —
 *  pas de rendition dans le master). */
export interface PrismAudioTrack { streamIndex: number; delivery: string }
/** Une rendition sous-titre du master, dans l'ordre du groupe AVPlayer. */
export interface PrismSubtitleRendition { name: string; language?: string; uri: string; isForced: boolean }

export interface PrismStart {
  url: string;
  gen: number;
  /** `keyframeIndexCache` / `builtFromSource` = VOD planifié (pause et seek
   *  libres) ; `sequential` = playlist EVENT (source sans index au premier
   *  visionnage, ou forme muxée pontée). */
  planOrigin: "keyframeIndexCache" | "builtFromSource" | "sequential" | "unknown";
  audioTracks: PrismAudioTrack[];
  subtitleRenditions: PrismSubtitleRendition[];
  durationSec?: number;
  /** Verdict des critères d'affichage tvOS (badge HDR/DV) : `willSwitch`,
   *  `wrote`, `alreadyActive`, `matchingDisabled`, `noWindow`. */
  displaySwitch?: string;
  displaySettle?: string;
  panelIsHDR?: boolean;
}

/** L'état du producteur d'une session (`PrismBridge.status`). `known` faux : la
 *  session n'existe plus (stoppée, remplacée). `failed` vrai : le producteur est
 *  mort, rien ne sera plus produit — `code` reprend la table des refus de
 *  `start()`. AVPlayer, lui, ne le dit jamais : il relance ses segments sans fin. */
export interface PrismStatus { gen: number; known: boolean; failed: boolean; code?: string; message?: string }

interface PrismBridgeModule {
  start?: (config: {
    url: string;
    headers?: Record<string, string>;
    preferredAudioLanguage?: string;
    segmentCacheBytes?: number;
  }) => Promise<PrismStart>;
  stop?: (gen: number) => void;
  status?: (gen: number) => Promise<PrismStatus>;
  fallbackMuxed?: (gen: number) => Promise<PrismStart>;
}

/** Module natif PrismBridge (tvOS uniquement). */
export const PrismBridge = (NativeModules as { PrismBridge?: PrismBridgeModule }).PrismBridge;

/**
 * Ne passer par PrismCore que si AVPlayer NE PEUT PAS lire la source tel quel.
 * AVPlayer tvOS lit nativement : conteneurs MP4/M4V/MOV (PAS MKV/TS), HEVC hvc1 /
 * H.264 avc1, audio AAC/AC3/EAC3/ALAC/FLAC/MP3/Opus, SDR. Murs → PrismCore :
 *  (1) conteneur ≠ MP4/MOV/M4V (MKV/TS/AVI… : AVPlayer refuse le conteneur) ;
 *  (2) audio non décodable (DTS/DTS-HD/TrueHD/PCM/Vorbis… → pont EAC3) ;
 *  (3) HDR / Dolby Vision : le master HLS porte la plage et PrismCore programme
 *      les critères d'affichage (badge) ; le profil 7 (double couche) est
 *      converti en 8.1 par libdovi — ce n'est plus un mur.
 * Un sous-titre image sélectionné ne force plus le transcode par principe : les
 * renditions OCR de PrismCore servent quand elles existent (cf.
 * prismSubtitleMatch), le burn-in serveur reste le repli.
 */
export function prismEligible(a: {
  container?: string;
  streams: JfStream[];
  audioIndex: number;
  vcodec?: string;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
}): boolean {
  const vstream = a.streams.find((s) => s.Type === "Video");
  const c = (a.container ?? "").toLowerCase();
  const nativeContainer = /\b(mp4|m4v|mov|qt)\b/.test(c);   // "mov,mp4,m4a,…" compte aussi
  const aud = a.streams.find((s) => s.Type === "Audio" && s.Index === a.audioIndex)
    ?? a.streams.find((s) => s.Type === "Audio");
  const acodec = (aud?.Codec ?? "").toLowerCase();
  const audioOk = acodec === "" || /^(aac|ac-?3|e-?ac-?3|ec-?3|alac|mp3|flac|opus)$/.test(acodec);
  // `VideoRangeType` arrive parfois en entier selon le point d'entrée Jellyfin ;
  // seule la forme chaîne est exploitable ici, `DvProfile` prend le relais.
  const plage = vstream?.VideoRangeType;
  const range = (typeof plage === "string" ? plage : "").toUpperCase();
  const isHdrOrDv = (vstream?.DvProfile ?? 0) > 0 || /HDR|PQ|HLG|DOVI|DOLBY/.test(range);
  const needsPrism = !nativeContainer || !audioOk || isHdrOrDv;
  return !a.forceTranscode && !a.isTranscodingQuality
    && !!PrismBridge?.start && needsPrism
    && (a.vcodec === "hevc" || a.vcodec === "h265" || a.vcodec === "h264");
}

/** En-têtes d'auth du lecteur natif — la règle vit dans `nativePlayerHeaders`. */
export const prismHeaders = nativePlayerHeaders;

/** Langue de la piste audio choisie, telle que PrismCore la marque `DEFAULT`. */
export function preferredAudioLanguageOf(streams: JfStream[], audioIndex: number): string | undefined {
  const lang = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex)?.Language?.trim().toLowerCase();
  return lang && lang !== "und" ? lang : undefined;
}

/**
 * Une seule tentative : PrismCore publie sa playlist complète avant le premier
 * paquet et son budget d'ouverture est explicite (30 s côté pont). Un échec
 * est un vrai échec — un second essai coûterait 30 s d'écran de chargement
 * pour le même verdict. Le code d'erreur est journalisé, le caller replie sur
 * PlaybackInfo.
 */
export async function startPrismCore(a: {
  rawUrl: string;
  headers?: Record<string, string>;
  preferredAudioLanguage?: string;
  /** Le fetch parent a été supplanté (fetchId) : abandonner sans consommer le résultat. */
  isCancelled: () => boolean;
}): Promise<PrismStart | null> {
  if (!PrismBridge?.start) return null;
  try {
    const res = await PrismBridge.start({
      url: a.rawUrl, headers: a.headers, preferredAudioLanguage: a.preferredAudioLanguage,
    });
    if (a.isCancelled()) { stopPrismCore(res.gen); return null; }
    plog("prism", `session gen=${res.gen} plan=${res.planOrigin} durée=${res.durationSec?.toFixed(0) ?? "?"}s`
      + ` audio=${JSON.stringify(res.audioTracks)} subs=${res.subtitleRenditions.length}`
      + ` affichage=${res.displaySwitch ?? "-"} hdr=${res.panelIsHDR ?? "?"}${res.displaySettle ? ` settle=« ${res.displaySettle} »` : ""}`);
    return res;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    plog("prism", `start() refusé : ${err?.code ?? "?"} ${err?.message ?? String(e)}`);
    if (a.isCancelled()) return null;
    return null;
  }
}

export function stopPrismCore(gen: number): void {
  if (gen > 0) PrismBridge?.stop?.(gen);
}

/** L'état du producteur de la session `gen` — à lire quand AVPlayer cale sur le
 *  flux local. `null` hors tvOS, ou si le pont ne répond pas. */
export async function prismStatus(gen: number): Promise<PrismStatus | null> {
  if (!PrismBridge?.status || gen <= 0) return null;
  try {
    return await PrismBridge.status(gen);
  } catch {
    return null;
  }
}

/** Master refusé par AVPlayer (toute erreur sur le flux local — cf.
 *  `AVPlayerSurface.handleError`) : rejoue la session en forme muxée. */
export async function fallbackMuxedPrismCore(gen: number): Promise<PrismStart | null> {
  if (!PrismBridge?.fallbackMuxed || gen <= 0) return null;
  try {
    const res = await PrismBridge.fallbackMuxed(gen);
    plog("prism", `forme muxée gen=${res.gen} (master refusé sur gen=${gen}) plan=${res.planOrigin}`);
    return res;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    plog("prism", `fallbackMuxed(${gen}) refusé : ${err?.code ?? "?"} ${err?.message ?? String(e)}`);
    return null;
  }
}

/**
 * Le serveur local d'une session répond-il encore ? Une suspension de l'app
 * peut le tuer (le système récupère les sockets d'écoute d'une app suspendue) ;
 * AVPlayer ne le découvrirait qu'au segment suivant, en pleine reprise. Une
 * requête de la playlist, bornée : sur le bouclage, une réponse saine arrive
 * en quelques millisecondes.
 */
export async function prismServing(url: string, timeoutMs = 600): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.replace(/#.*$/, ""), { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
