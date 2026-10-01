import type { MediaStream, ProfileCondition } from "../types/media";

/** Les étiquettes HEVC qu'AVFoundation lit telles quelles. */
export const AV_PLAYER_HEVC_TAGS = ["hvc1", "dvh1"] as const;

/**
 * L'étiquette d'un flux HEVC dans un conteneur MP4 / MOV, telle
 * qu'AVFoundation la lit — UNE règle pour ses trois lecteurs : AVPlayer sur
 * Apple TV, AVPlayer sur iPhone et iPad (le lecteur système du mobile), et le
 * `<video>` de Safari (WebKit, sur macOS comme sur iOS — le miroir compris).
 *
 * `hvc1` range les paramètres du flux (VPS/SPS/PPS) dans l'entrée
 * d'échantillon ; `hev1` les laisse dans le flux. AVFoundation ne lit que la
 * première, et `dvh1`, son pendant Dolby Vision : sous AVPlayer, un `hev1`
 * donne une image NOIRE, le son seul, et AUCUNE erreur — rien ne déclenche le
 * moindre repli. Mesuré au simulateur tvOS : un MP4 HEVC 10 bits `hev1` (« On
 * l'appelait Robin des Bois ») reste noir de bout en bout, alors qu'un `hvc1`
 * du même profil (Lucifer S1E1) s'affiche ; au simulateur iOS 26.3, même noir
 * pour un `hev1` synthétique, la lecture avançant. Safari, lui, refuse le
 * `<video>` (`MEDIA_ERR_SRC_NOT_SUPPORTED`), et le lecteur web ne s'en relève
 * pas.
 *
 * Une étiquette INCONNUE (un scan Jellyfin ancien ne la renseigne pas, et
 * Jellyfin 12.1 plus du tout) ne prouve rien : elle ne se lit pas telle quelle
 * non plus. Le relais revient à
 * un lecteur qui lit tout (mpv sur le mobile, PrismCore sur Apple TV, qui
 * réécrit l'entrée en `hvc1`), sinon au remux du serveur.
 */
export function avPlayerReadsHevcTag(tag: string | null | undefined): boolean {
  const normalized = (tag ?? "").trim().toLowerCase();
  return (AV_PLAYER_HEVC_TAGS as readonly string[]).includes(normalized);
}

/**
 * Un flux vidéo HEVC qu'AVFoundation n'affichera pas tel quel : étiqueté
 * `hev1`, `dvhe` ou d'une étiquette inconnue. Un autre codec n'est pas
 * concerné.
 */
export function hevcTagUnreadable(stream: Pick<MediaStream, "Codec" | "CodecTag"> | null | undefined): boolean {
  const codec = (stream?.Codec ?? "").trim().toLowerCase();
  if (codec !== "hevc" && codec !== "h265") return false;
  return !avPlayerReadsHevcTag(stream?.CodecTag);
}

/**
 * La même règle, dite au serveur : la condition du profil HEVC d'un lecteur
 * AVFoundation (profil tvOS, lecteur système iOS, Safari).
 *
 * Jellyfin — lu dans les sources de 10.11 et de 12 — ne donne plus en lecture
 * directe un HEVC dont l'étiquette manque à la liste
 * (`VideoCodecTagNotSupported`). Il le sert en HLS fMP4 : la vidéo COPIÉE
 * (cette raison compte parmi ses `DirectStreamReasons`, et `CanStreamCopyVideo`
 * ne lit aucune étiquette) et ré-étiquetée `hvc1` (« Prefer hvc1 to hev1 »,
 * `DynamicHlsController`). Un remux, jamais un réencodage. Mesuré sur un
 * Jellyfin 10.11 jetable : un MP4 HEVC 10 bits `hev1` sort en
 * `-codec:v:0 copy -tag:v:0 hvc1`, l'entrée du segment d'initialisation est
 * bien `hvc1` ; sans la condition, il partait en lecture directe.
 *
 * `IsRequired: true` : une étiquette INCONNUE ne passe pas non plus, comme
 * dans `avPlayerReadsHevcTag` — et comme jellyfin-web le pose pour Safari. Le
 * prix se borne à un remux : un MKV, sans étiquette, garde sa vidéo copiée
 * (même mesure, `-codec:v:0 copy`).
 *
 * Jellyfin 12.1 ne renseigne plus `CodecTag` du tout (champ vide en base, même
 * après un rafraîchissement complet) : toute étiquette y est inconnue. Avec
 * `false`, le `hev1` y repartait en lecture directe — le noir revenait ; avec
 * `true`, tout HEVC en MP4, `hvc1` compris, y est remuxé, l'image copiée
 * (mesuré : `-codec:v:0 copy -tag:v:0 hvc1`). Jamais de noir.
 */
export function avPlayerHevcTagCondition(): ProfileCondition {
  return {
    Condition: "EqualsAny",
    Property: "VideoCodecTag",
    Value: AV_PLAYER_HEVC_TAGS.join("|"),
    IsRequired: true,
  };
}
