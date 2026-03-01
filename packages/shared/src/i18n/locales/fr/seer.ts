export default {
  // Plugin metadata
  pluginName: "Seer - Demandes de médias",
  pluginDescription: "Demandez des films et séries via Jellyseerr. Découvrez du contenu, demandez en 1 clic, suivez vos demandes.",

  // Navigation
  navDiscover: "Découvrir",
  navRequests: "Demandes",
  navMyRequests: "Mes demandes",
  navConfig: "Configuration Seer",
  navSeer: "Seer",

  // Discover
  discoverTitle: "Découvrir",
  searchPlaceholder: "Rechercher un film, une série...",
  previousPage: "Précédent",
  nextPage: "Suivant",
  noResults: "Aucun résultat",
  noContent: "Aucun contenu disponible",

  // Media types
  typeMovie: "Film",
  typeSeries: "Série",
  typeAnime: "Anime",
  untitled: "Sans titre",

  // Media card
  noImage: "Pas d'image",
  sending: "Envoi...",
  request: "Demander",
  viewSeasons: "Voir les saisons",
  alreadyRequested: "Déjà demandé",

  // Requests page
  filterAll: "Toutes",
  filterQueued: "En attente",
  filterProcessing: "En cours",
  filterApproved: "Approuvées",
  filterAvailable: "Disponibles",
  filterFailed: "Échecs",
  myRequestsTitle: "Mes demandes",
  noRequestsAll: "Vous n'avez aucune demande",
  noRequestsFiltered: "Aucune demande avec ce statut",

  // Request card
  seasonsLabel: "Saison(s) : {{seasons}}",
  retry: "Redemander",
  delete: "Supprimer",
  notAvailable: "N/A",

  // Media detail modal
  requestingMovie: "Envoi de la demande...",
  requestMovie: "Demander ce film",

  // Season picker
  seasonsTitle: "Saisons",
  selectAll: "Tout",
  selectNone: "Aucun",
  seasonFallback: "Saison {{number}}",
  episodeCount_one: "{{count}} épisode",
  episodeCount_other: "{{count}} épisodes",
  requestSeasons_one: "Demander {{count}} saison",
  requestSeasons_other: "Demander {{count}} saisons",

  // Media type filter
  filterAllType: "Tout",
  filterMovies: "Films",
  filterSeries: "Séries",
  filterAnimes: "Animés",

  // Sort selector
  sortPopularity: "Popularité",
  sortTrending: "Tendances",
  sortRating: "Note",
  sortRecent: "Récent",

  // Config page
  configTitle: "Configuration Seer",
  statusConnected: "Connecté",
  statusError: "Erreur",
  statusTesting: "Test...",
  statusNotConfigured: "Non configuré",
  urlLabel: "URL Jellyseerr",
  urlPlaceholder: "https://jellyseerr.example.com",
  testButton: "Tester",
  apiKeyLabel: "Clé API",
  apiKeyPlaceholder: "Clé API Jellyseerr",
  toggleEnabled: "Activer Seer",
  toggleEnabledDesc: "Active le plugin de demandes de médias",
  toggleAutoApprove: "Auto-approbation",
  toggleAutoApproveDesc: "Approuver automatiquement les demandes",
  userLimitLabel: "Limite par utilisateur (0 = illimité)",
  saving: "Sauvegarde...",
  save: "Sauvegarder",
  connectionSuccess: "Connexion réussie",
  connectionFailed: "Échec de la connexion",
  connectionUnreachable: "Impossible de joindre le serveur",
  configSaved: "Configuration sauvegardée",
  configSaveError: "Erreur lors de la sauvegarde",
  networkError: "Erreur réseau",

  // Status labels
  statusQueued: "En attente",
  statusProcessing: "Traitement",
  statusSentToSeer: "Envoyé",
  statusApproved: "Approuvé",
  statusDownloading: "Téléchargement",
  statusAvailable: "Disponible",
  statusFailed: "Échec",
  statusCancelled: "Annulé",
} as const;
