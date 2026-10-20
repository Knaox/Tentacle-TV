import { negotiatedRefusal, rightsBitrate, type MediaSource, type PlaybackRights } from "@tentacle-tv/shared";

/**
 * La diffusion vers une TV face aux droits de lecture du compte
 * (docs/DROITS-UTILISATEURS.md § 9.2, § 9.10) — règle PURE. Un récepteur Google
 * Cast ne lit presque rien tel quel : le serveur convertit. Sans le droit de
 * réencoder l'image (ou sans lecture du tout), la diffusion est refusée
 * d'avance, avec un message, au lieu d'un flux illisible ; le plafond de débit
 * de ce client borne ce que la TV demande.
 */
export function castRightsBefore(rights: PlaybackRights): { refused: boolean; maxBitrate: number | undefined } {
  if (!rights.mediaPlayback || !rights.videoTranscoding) return { refused: true, maxBitrate: undefined };
  return { refused: false, maxBitrate: rightsBitrate(undefined, rights) };
}

/** La proposition de Jellyfin pour la TV demande-t-elle une conversion refusée au compte ? */
export function castRightsAfter(rights: PlaybackRights, ms: MediaSource, directPlay: boolean): boolean {
  return negotiatedRefusal(rights, ms, directPlay, ms.TranscodingUrl ?? null) !== null;
}
