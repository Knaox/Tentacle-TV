export type RootStackParamList = {
  Disclaimer: undefined;
  PairCode: undefined;
  /** « Qui regarde ? » (Apple TV, Famille) : `launch` — démarrage, session
   *  fermée par le serveur ; `switch` — « Changer de profil ». */
  /** `returnTo` : on revient de « Gérer les profils » — le focus y retourne. */
  Profiles: { intent: "launch" | "switch"; returnTo?: "manage" };
  /** « Gérer les profils » (le profil du propriétaire) : `origin` — d'où l'on
   *  vient ; depuis « Qui regarde ? », Retour y ramène (la session du
   *  propriétaire, ouverte pour gérer, se referme). */
  ManageProfiles: { origin: "profiles" | "settings" };
  /** SON code PIN (Réglages › Compte) : créer, changer, retirer. */
  ProfilePin: { mode: "create" | "change" | "remove" };
  /** `entrance` : l'arrivée depuis « Qui regarde ? » — l'accueil fond par-dessus. */
  Home: { entrance?: boolean } | undefined;
  /** « Pour vous » : recommandations de la bibliothèque seule. */
  Recommendations: undefined;
  Library: { libraryId: string; libraryName: string };
  /** `seasonId` : la saison où ouvrir une série — celle du dernier ajout d'une carte regroupée des « Derniers ajouts ». */
  MediaDetail: { itemId: string; seasonId?: string };
  Player: { itemId: string };
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
