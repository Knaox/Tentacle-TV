export type RootStackParamList = {
  Disclaimer: undefined;
  PairCode: undefined;
  Home: undefined;
  Library: { libraryId: string; libraryName: string };
  MediaDetail: { itemId: string };
  Player: { itemId: string };
  /** Panneau Réglages/Qualité présenté en MODALE transparente au-dessus du
   *  Player : sur tvOS, le Menu ferme proprement la modale (révèle l'épisode
   *  dessous) sans le flash du pop d'écran poussé. */
  PlayerSettings: undefined;
  Trailer: { url: string; name?: string };
  Search: undefined;
  Watchlist: undefined;
  Favorites: undefined;
  Settings: undefined;
};
