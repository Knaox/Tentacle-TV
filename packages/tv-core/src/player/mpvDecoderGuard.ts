/**
 * La GARDE du décodeur de mpv sur une Android TV faible — jamais de décodage
 * logiciel silencieux sur des Cortex-A53.
 *
 * Sur Android TV, ExoPlayer lit d'abord ; mpv ne prend la main qu'après une
 * erreur d'Exo, sur un flux SERVI (H.264 + AAC du repli, ou l'image incrustée
 * d'un sous-titre). mpv essaie `mediacodec` puis `mediacodec-copy`, et retombe
 * EN SILENCE sur le décodage logiciel quand aucun ne s'ouvre : sur une box, la
 * vidéo saccade puis s'arrête. Ce qu'il fait vraiment se lit dans sa propriété
 * `hwdec-current` (`mediacodec`, `mediacodec-copy`, ou `no`).
 *
 * La règle, en mode Lite :
 * - `mediacodec` (zéro copie) : il garde la main ;
 * - `mediacodec-copy` : il la garde jusqu'à la définition de l'écran d'une box
 *   (1080p) — au-delà, la recopie de chaque image par le processeur ne tient
 *   pas (4K : ~12 Mo par image) ;
 * - logiciel (`no`, vide) : il RENDS LA MAIN à ExoPlayer, qui lit le MÊME flux
 *   servi (H.264 + AAC, ce que tout décodeur matériel lit) par MediaCodec,
 *   sur sa surface — jamais une conversion de plus, jamais un arrêt.
 *
 * En mode normal (Shield, Apple TV), rien ne change : mpv garde la main quoi
 * qu'il décode, comme avant (un A57 tient un 1080p logiciel).
 */

export type MpvHwdec = "mediacodec" | "mediacodec-copy" | "software";

/** Ce que dit `hwdec-current` de mpv, ramené à trois cas. Vide / `no` / inconnu : logiciel. */
export function parseMpvHwdec(value: string | null | undefined): MpvHwdec {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "mediacodec" || v === "mediacodec-copy") return v;
  return "software";
}

export type MpvDecoderVerdict = "keep" | "toExo";

/** La plus grande image que `mediacodec-copy` recopie sur une box (1080p). */
export const MPV_COPY_MAX_HEIGHT = 1088;

/** L'erreur que la garde rend au lecteur (comme une erreur du moteur) : « rendre la main à Exo ». */
export const MPV_SOFTWARE_DECODE = "MPV_SOFTWARE_DECODE";

export function mpvDecoderVerdict(input: {
  lite: boolean;
  hwdec: MpvHwdec;
  /** Hauteur de l'image décodée (`video-params/h`) ; 0 : pas encore connue. */
  videoHeight: number;
}): MpvDecoderVerdict {
  if (!input.lite) return "keep";
  if (input.hwdec === "mediacodec") return "keep";
  if (input.hwdec === "mediacodec-copy") return input.videoHeight > MPV_COPY_MAX_HEIGHT ? "toExo" : "keep";
  return "toExo";
}
