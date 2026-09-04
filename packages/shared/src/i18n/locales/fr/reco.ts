export default {
  // Notation
  yourRating: "Votre note",
  rateAria: "Noter {{score}} sur 10",
  removeRatingAria: "Retirer votre note ({{score}}/10)",
  ratingValue: "{{score}}/10",
  ratingSyncPending: "Synchronisation en attente",
  ratingSyncFailed: "Échec de synchronisation",

  // Page
  pageTitle: "Recommandations",
  heroKicker: "Notre meilleure suggestion",
  heroForYou: "Sélectionné pour vous",
  heroOpenDetail: "Voir la fiche",
  heroOpenVigie: "Voir dans le catalogue",
  warmingHint: "Vos recommandations s'affinent à mesure que vous notez des titres.",
  generatingHint: "Construction de vos recommandations — la première visite prend un instant.",
  preliminaryHint: "Premières suggestions — vos recommandations s'affinent en arrière-plan.",
  exploringHint:
    "On explore vos goûts — en attendant, voici le meilleur de votre bibliothèque. Ça se personnalise dans un instant.",
  heroRegionAria: "Recommandations en vedette",
  communityRatingAria: "Note globale {{score}} sur 10",
  providersFilterAria: "Filtrer par plateforme",
  providersAll: "Toutes les plateformes",
  filtersButton: "Filtres",
  filtersPlatformsLabel: "Plateformes",
  filterEmpty: "Rien à proposer sur les plateformes sélectionnées — élargissez le filtre.",
  // Puce du filtre sur l'accueil (à côté du titre de la première rangée reco servie)
  homeFilterRemove: "Retirer le filtre de plateformes",
  homeFilterGeneric: "Filtre de plateformes",
  rowWithActor: "Avec {{name}}",
  actorsTitle: "Vos acteurs",
  actorsHint:
    "Aimez des acteurs ou des réalisateurs : des rangées « Avec … » naîtront de vos choix. Cherchez un nom, piochez dans les suggestions, ou aimez-les depuis le casting d'une fiche.",
  actorsSuggested: "Acteurs connus — pour commencer",
  actorsResults: "Résultats",
  actorsSearchPlaceholder: "Chercher un acteur, un réalisateur…",
  actorsRemove: "Retirer {{name}}",
  actorsLike: "Aimer {{name}}",
  actorsNoResult: "Aucun résultat.",
  disabledBody:
    "Les recommandations personnalisées sont désactivées pour votre compte. Activez-les dans vos réglages de personnalisation pour recevoir des suggestions à votre goût.",
  disabledCta: "Ouvrir les réglages de personnalisation",

  // Bandeaux d'état (un seul à la fois, RecoStatusBanner)
  disabledBanner:
    "Les recommandations personnalisées sont désactivées pour votre compte — voici des suggestions générales.",
  disabledBannerCta: "Activer dans les réglages",
  tmdbAdminBanner:
    "Ajoutez votre clé TMDB (Admin → Métadonnées) pour activer les recommandations personnalisées.",
  tmdbAdminBannerCta: "Ouvrir les réglages de métadonnées",
  genericOnlyHint: "Suggestions générales — la personnalisation n'est pas disponible pour le moment.",
  coldBannerHint:
    "Vos recommandations personnalisées attendent encore quelques signaux — dites-nous ce que vous aimez.",
  coldBannerCta: "Choisir des titres",

  // Rangées
  rowForYou: "Pour vous",
  rowInLibrary: "Disponible dans votre bibliothèque",
  rowDiscover: "À découvrir",
  rowBecauseYouLiked: "Parce que vous avez aimé {{title}}",
  rowCommunity: "Les utilisateurs de Tentacle regardent aussi",
  rowExploration: "Sortir de votre zone de confort",
  rowAnime: "Animés pour vous",
  // Rangées GLOBALES (servies à tous, quel que soit l'état du profil).
  rowTrending: "Tendances",
  rowServerPulse: "Ce que les utilisateurs de Tentacle regardent",
  rowBestOfLibrary: "Les mieux notés de votre bibliothèque",

  // Cartes
  onDemandBadge: "À la demande",
  explorationBadge: "Découverte",
  dismissAction: "Ne plus me proposer",
  unavailableHint: "indisponible",

  // Raisons (explicabilité)
  reasonSeed: "Parce que vous avez aimé {{title}}",
  reasonExploration: "Exploration : hors de vos habitudes",
  reasonAnime: "Parce que vous regardez des animés",
  reasonDirector: "Réalisé par {{name}}",
  reasonActor: "Avec {{name}}",
  reasonGenre: "Parce que vous aimez le genre {{name}}",
  // Genres TMDB (ids stables, films + séries) — les libellés du cache de
  // métadonnées arrivent en anglais, on traduit ici. La locale anglaise n'a
  // pas ces clés : elle retombe sur le libellé TMDB, déjà anglais.
  genreLabel_28: "Action",
  genreLabel_12: "Aventure",
  genreLabel_16: "Animation",
  genreLabel_35: "Comédie",
  genreLabel_80: "Policier",
  genreLabel_99: "Documentaire",
  genreLabel_18: "Drame",
  genreLabel_10751: "Familial",
  genreLabel_14: "Fantastique",
  genreLabel_36: "Histoire",
  genreLabel_27: "Horreur",
  genreLabel_10402: "Musique",
  genreLabel_9648: "Mystère",
  genreLabel_10749: "Romance",
  genreLabel_878: "Science-fiction",
  genreLabel_10770: "Téléfilm",
  genreLabel_53: "Thriller",
  genreLabel_10752: "Guerre",
  genreLabel_37: "Western",
  genreLabel_10759: "Action & Aventure",
  genreLabel_10762: "Jeunesse",
  genreLabel_10763: "Actualités",
  genreLabel_10764: "Téléréalité",
  genreLabel_10765: "Science-fiction & Fantastique",
  genreLabel_10766: "Feuilleton",
  genreLabel_10767: "Talk-show",
  genreLabel_10768: "Guerre & Politique",
  reasonTheme: "Thème : {{name}}",
  reasonStudio: "De {{name}}",
  reasonDecade: "Des années {{decade}}",

  // Démarrage à froid
  coldKicker: "Personnalisation",
  coldTitle: "Dites-nous ce que vous aimez",
  coldBody:
    "Touchez les titres que vous avez aimés — il en faut au moins cinq pour construire vos premières recommandations. Plus vous en choisissez, plus elles seront justes.",
  coldProgress: "{{count}} sur 5",
  coldReadyHint: "C'est assez pour démarrer — continuez si vous voulez affiner.",
  coldCta: "Voir mes recommandations",
  coldLater: "Plus tard",
  coldMore: "Afficher d'autres titres",
};
