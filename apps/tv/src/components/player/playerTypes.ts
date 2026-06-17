/* ------------------------------------------------------------------ */
/*  Types NEUTRES du lecteur (sans suffixe plateforme)                 */
/*                                                                     */
/*  Partagés tels quels par les surfaces natives Android (ExoPlayer/   */
/*  MPVPlayer via requireNativeComponent) ET tvOS (react-native-video, */
/*  *.ios.tsx). Les garder ici (et non dans MPVPlayer.tsx) évite que   */
/*  les `import type … from "./MPVPlayer"` résolvent vers le variant    */
/*  `.ios` sur tvOS et le `.tsx` sur Android → divergence de types.    */
/* ------------------------------------------------------------------ */

export interface MpvTrack {
  id: number;
  type: "video" | "audio" | "sub";
  lang: string;
  title: string;
  codec: string;
  default: boolean;
  selected: boolean;
  /** ExoPlayer Format.id — pour les pistes texte side-loadées = jellyfinIndex */
  nativeId?: string;
}

/** Contrat impératif commun à toutes les surfaces natives (Android + tvOS). */
export interface MPVPlayerHandle {
  seek: (seconds: number) => void;
  setAudioTrack: (id: number) => void;
  setSubtitleTrack: (id: number) => void;
  addSubtitleTrack: (url: string) => void;
  loadSubtitle?: (url: string | null) => void;
}

/** Piste texte VTT (Jellyfin) chargée nativement pour le subtitleView ExoPlayer. */
export interface ExoTextTrack {
  uri: string;
  language: string;
  label: string;
  jellyfinIndex: number;
}
