export type RootStackParamList = {
  Disclaimer: undefined;
  PairCode: undefined;
  Home: undefined;
  /** « Pour vous » : recommandations de la bibliothèque seule. */
  Recommendations: undefined;
  Library: { libraryId: string; libraryName: string };
  MediaDetail: { itemId: string };
  /** `startPaused` : la relance à froid rouvre le lecteur en pause, à la position. */
  Player: { itemId: string; startPaused?: boolean };
  /** Panneau Réglages/Qualité présenté en MODALE transparente au-dessus du
   *  Player : sur tvOS, le Menu ferme proprement la modale (révèle l'épisode
   *  dessous) sans le flash du pop d'écran poussé. */
  PlayerSettings: undefined;
  /** `itemId` : l'œuvre de la bande-annonce — son image et son titre pendant le chargement. */
  Trailer: { url: string; name?: string; itemId?: string };
  Search: undefined;
  /** Recherche approfondie : filmographie d'une personne, genre ou studio. */
  SearchBrowse: { kind: "person" | "genre" | "studio"; id?: string; name: string };
  Watchlist: undefined;
  Favorites: undefined;
  /** `tab` : l'onglet à l'ouverture (« Réglages de la navigation », Apple TV). */
  Settings: { tab?: "navigation" } | undefined;
};
