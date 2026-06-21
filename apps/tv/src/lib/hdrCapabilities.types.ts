/**
 * Capacités de DÉCODAGE matériel de l'Apple TV (modèle de la box, indépendant de
 * l'écran connecté). Renseignées par le module natif `HDRCapabilities`
 * (VideoToolbox), calqué sur Swiftfin `PlaybackCapabilities`.
 *
 * Sert à gater le `VideoRangeType` du DeviceProfile Jellyfin : on ne déclare une
 * plage HDR/DV que si la box sait la décoder → Jellyfin remux (HDR préservé) au
 * lieu de tone-mapper vers SDR.
 */
export interface HdrCapabilities {
  /** Décodage HEVC matériel (⇒ HDR10/HLG gérés, tvOS adapte la sortie écran). */
  hevc: boolean;
  hdr10: boolean;
  hlg: boolean;
  /** Décodage Dolby Vision HEVC matériel (Apple TV 4K uniquement). */
  dolbyVision: boolean;
  /** Écran HDR actuellement connecté — diagnostic, NON utilisé pour gater. */
  eligibleForHDR: boolean;
}
