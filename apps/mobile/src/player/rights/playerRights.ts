import {
  lighterPreset,
  negotiatedRefusal,
  rightsBitrate,
  rightsCapTier,
  upfrontRefusal,
  type MediaSource,
  type PlaybackRefusal,
  type PlaybackRights,
  type QualityPreset,
} from "@tentacle-tv/shared";

/**
 * Les droits de lecture du compte appliqués par le lecteur mobile
 * (docs/DROITS-UTILISATEURS.md § 9.2, § 9.10) — la règle partagée du web, du
 * bureau et des téléviseurs, réunie pour la négociation : un mode refusé n'est
 * jamais demandé, et le lecteur dit pourquoi au lieu de recevoir un flux
 * illisible. Le serveur refuse de toute façon (proxy). Module PUR.
 */
export interface PlayerRights {
  /** Le refus connu avant toute requête (lecture interdite, fichier au-dessus du plafond sans droit de réencoder). */
  refusalBefore: () => PlaybackRefusal | null;
  /** Le refus de la proposition de Jellyfin (fichier tel quel, ou son URL de conversion). */
  refusalOf: (negotiated: MediaSource, directPlay: boolean) => PlaybackRefusal | null;
  /** Le débit à demander, borné au plafond de ce client (0 : aucun). */
  capBitrate: (bitrate: number) => number;
  /** Le palier servi, borné par le plafond du serveur — même en « Originale » choisie à la main. */
  withCap: (preset: QualityPreset) => QualityPreset;
}

export function playerRightsOf(rights: PlaybackRights, source: MediaSource | undefined): PlayerRights {
  const cap = rightsCapTier(source, rights);
  return {
    refusalBefore: () => upfrontRefusal(rights, source),
    refusalOf: (negotiated, directPlay) => negotiatedRefusal(rights, negotiated, directPlay, negotiated.TranscodingUrl ?? null),
    capBitrate: (bitrate) => rightsBitrate(bitrate > 0 ? bitrate : undefined, rights) ?? 0,
    withCap: (preset) => (cap ? lighterPreset(preset, cap) ?? preset : preset),
  };
}
