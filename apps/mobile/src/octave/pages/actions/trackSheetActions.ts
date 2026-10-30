/**
 * Octave mobile — QUELLES actions la feuille d'un titre propose, dans l'ordre du
 * menu « ⋯ » du bureau. Règle pure : chaque action soumise à un droit n'existe
 * que si sa source le permet — le lecteur (lire, ensuite, file), les droits
 * Sillon d'ajout (`canAddToPlaylist`, `canLike` : `useAcquireRights`, la source
 * du bureau), le droit hors ligne (`keep` : la surface « garder » de m5,
 * `canKeepTrack`), une page où aller (album, artiste). Sans le droit : absente,
 * jamais grisée. Ouverte depuis une playlist qui le permet, « Retirer de la
 * playlist » vient en tête ; « Ajouter à une playlist » reste (vers une autre).
 */

export type TrackSheetActionId = "removeFromPlaylist" | "play" | "playNext" | "addToQueue" | "addToPlaylist" | "keep" | "removeKept" | "like" | "goToAlbum" | "goToArtist";

export interface TrackSheetFacts {
  hasPlayer: boolean;
  canAddToPlaylist: boolean;
  canLike: boolean;
  /** `keep` : le droit et un titre gardable ; `remove` : déjà gardé (le retrait reste possible) ; `none` : rien. */
  keep: "keep" | "remove" | "none";
  albumTarget: string | null;
  artistTarget: string | null;
  hide?: { album?: boolean; artist?: boolean };
  /** Ouverte depuis une playlist qui permet de retirer ce titre. */
  canRemoveFromPlaylist?: boolean;
}

export function trackSheetActions(f: TrackSheetFacts): TrackSheetActionId[] {
  const out: TrackSheetActionId[] = [];
  // Dans une playlist, le retrait passe EN TÊTE (lot fl, Damien : « ⋯ » proposait d'ajouter, pas de retirer).
  if (f.canRemoveFromPlaylist) out.push("removeFromPlaylist");
  if (f.hasPlayer) out.push("play", "playNext", "addToQueue");
  if (f.canAddToPlaylist) out.push("addToPlaylist");
  if (f.keep === "keep") out.push("keep");
  if (f.keep === "remove") out.push("removeKept");
  if (f.canLike) out.push("like");
  if (f.albumTarget && !f.hide?.album) out.push("goToAlbum");
  if (f.artistTarget && !f.hide?.artist) out.push("goToArtist");
  return out;
}
