/**
 * Ce que le LECTEUR d'un client décode, et le flux que le relais lui sert —
 * le client DÉCLARE, la règle décide (comme `playback/engineCapabilities.ts`
 * pour le transcodage).
 *
 * Le relais des bandes-annonces sert du H.264 + AAC : ce que tout appareil
 * lit… sauf un Chromium construit SANS les codecs propriétaires — le bureau
 * CEF (binaires publics : `MediaSource.isTypeSupported` y refuse `avc1` et
 * `mp4a`, mesuré le 10/11/2026 sur les trois systèmes). Ce Chromium-là lit le
 * VP9 et l'Opus, que YouTube fournit aussi : face à un serveur qui déclare la
 * capacité `trailers.openCodecs`, il le DIT (`dec=vp9,opus`) et reçoit un
 * maître VP9 dont l'audio est l'Opus de YouTube, réemballé par le serveur.
 *
 * Un client qui lit le H.264 et l'AAC ne dit RIEN : ses requêtes, leurs
 * réponses et leurs caches restent ceux d'avant, octet pour octet.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/trailers/`
 * (`trailersMirror.test.ts`). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/trailers/trailerCodecs.ts apps/backend/src/trailers/
 *
 * Aucun import : le fichier compile seul des deux côtés.
 */

/** Les codecs dont dépend le choix du flux (liste FERMÉE : ces mots traversent le réseau). */
export const TRAILER_CODECS = ["h264", "aac", "vp9", "opus"] as const;
export type TrailerCodec = (typeof TRAILER_CODECS)[number];

/**
 * Le flux servi : `h264` (H.264 + AAC, celui de toujours — maître HLS de
 * YouTube ou de Dailymotion, MP4 de repli) ou `open` (VP9 + Opus, YouTube
 * seulement).
 */
export type TrailerDelivery = "h264" | "open";

/** Le paramètre de requête qui porte la déclaration (`dec=vp9,opus`). */
export const TRAILER_DECODES_PARAM = "dec";

/**
 * Le type MIME à éprouver pour chaque codec (`MediaSource.isTypeSupported`) :
 * ceux que le relais sert vraiment — la 1080p H.264 et l'AAC des maîtres de
 * YouTube, son VP9 en MP4 fragmenté, l'Opus réemballé en MP4.
 */
export const TRAILER_CODEC_PROBES: Readonly<Record<TrailerCodec, string>> = {
  h264: 'video/mp4; codecs="avc1.640028"',
  aac: 'audio/mp4; codecs="mp4a.40.2"',
  vp9: 'video/mp4; codecs="vp09.00.40.08"',
  opus: 'audio/mp4; codecs="opus"',
};

/** Ce qu'un lecteur décode, d'après une sonde (`MediaSource.isTypeSupported` côté web). */
export function probeTrailerDecodes(supports: (mimeType: string) => boolean): TrailerCodec[] {
  return TRAILER_CODECS.filter((codec) => {
    try {
      return supports(TRAILER_CODEC_PROBES[codec]);
    } catch {
      return false;
    }
  });
}

const has = (decodes: readonly TrailerCodec[], ...codecs: TrailerCodec[]) => codecs.every((codec) => decodes.includes(codec));

/**
 * LA règle : le flux pour ce que le lecteur décode. `null` (rien de déclaré :
 * un client d'avant, un téléviseur) vaut le H.264 de toujours ; H.264 + AAC
 * l'emportent (matériel partout, Dailymotion compris) ; sinon VP9 + Opus si
 * le serveur sait le servir (`openCodecs`) ; sinon RIEN — aucun flux ne se
 * lirait, on ne propose pas une bande-annonce qui échouera.
 */
export function trailerDeliveryFor(decodes: readonly TrailerCodec[] | null, server: { openCodecs: boolean }): TrailerDelivery | null {
  if (decodes === null || has(decodes, "h264", "aac")) return "h264";
  return server.openCodecs && has(decodes, "vp9", "opus") ? "open" : null;
}

/**
 * Ce que le client écrit dans sa requête : RIEN (`null`) s'il lit le H.264 et
 * l'AAC — la requête d'avant —, sinon ses codecs, dans l'ordre de la liste.
 */
export function trailerDecodesParam(decodes: readonly TrailerCodec[] | null | undefined): string | null {
  if (!decodes || has(decodes, "h264", "aac")) return null;
  return TRAILER_CODECS.filter((codec) => decodes.includes(codec)).join(",");
}

/**
 * La déclaration que porte une requête : `null` sans paramètre (client
 * d'avant), sinon les codecs connus qu'il nomme — un mot inconnu est ignoré,
 * un paramètre vide ou illisible vaut « ne décode rien ».
 */
export function parseTrailerDecodes(value: unknown): TrailerCodec[] | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return [];
  const named = value.split(",").map((word) => word.trim().toLowerCase());
  return TRAILER_CODECS.filter((codec) => named.includes(codec));
}
