/**
 * Les pages PUBLIQUES de partage : liste partagée (Ma liste ou titres likés)
 * et fiche partagée (/share/:token/:itemId). Le lecteur n'a souvent pas de
 * compte : chaque texte doit dire ce qu'on lui montre et comment rejoindre le
 * serveur, jamais l'envoyer vers un geste qui exige une session.
 *
 * ⚠️ Aucun « téléchargement » ni « download » ici : le miroir téléphone lit
 * ces clés.
 */
export default {
  kickerWatchlist: "Liste partagée",
  kickerLikes: "Titres likés partagés",
  titleWatchlist: "La liste de {{name}}",
  titleLikes: "Les coups de cœur de {{name}}",
  summaryTitles_one: "{{count}} titre",
  summaryTitles_other: "{{count}} titres",
  summaryMovies_one: "{{count}} film",
  summaryMovies_other: "{{count}} films",
  summarySeries_one: "{{count}} série",
  summarySeries_other: "{{count}} séries",
  summaryOffServer_one: "{{count}} hors du serveur",
  summaryOffServer_other: "{{count}} hors du serveur",
  readOnlyNote: "Lecture seule : vous voyez les titres choisis par {{name}}, rien d'autre de son compte.",
  liveNote: "Le lien suit la liste en direct.",

  joinTitle: "Envie de les regarder ?",
  joinLead: "Ces titres sont sur un serveur Tentacle TV privé. Pour les lire, il faut un compte sur ce serveur.",
  joinStep1: "Demandez une invitation à {{name}}.",
  joinStep2: "Créez votre compte avec le code reçu.",
  joinStep3: "Connectez-vous : ce partage vous attendra.",
  joinSignIn: "Se connecter",
  joinRegister: "J'ai une invitation",
  joinSteps: "Rejoindre le serveur, en trois étapes",

  memberTitle: "Vous êtes sur ce serveur",
  memberLeadWatchlist: "Cochez des titres pour les ajouter à votre liste.",
  memberLeadLikes: "Cochez des titres pour les ajouter à vos favoris.",
  memberLeadStats: "Vos propres statistiques vous attendent dans l'application, depuis votre profil.",
  openApp: "Ouvrir Tentacle TV",

  offServerBadge: "Hors serveur",
  offServerHint: "Ce titre n'est pas encore sur le serveur : pas de fiche à ouvrir.",
  selectTitle: "Sélectionner {{name}}",
  openTitle: "Voir la fiche de {{name}}",
  selectAll: "Tout cocher",
  deselectAll: "Tout décocher",
  selectedCount_one: "{{count}} titre coché",
  selectedCount_other: "{{count}} titres cochés",
  addToWatchlist: "Ajouter à ma liste",
  addToFavorites: "Ajouter à mes favoris",
  adding: "Ajout…",
  addedWatchlist: "Ajoutés à votre liste",
  addedFavorites: "Ajoutés à vos favoris",

  emptyTitle: "Rien ici pour l'instant",
  emptyLead: "{{name}} n'a encore rien mis dans cette liste. Revenez plus tard : le lien suit la liste en direct.",
  errorTitle: "Impossible d'ouvrir ce partage",
  errorLead: "Le lien a peut-être été révoqué par son auteur ou mal copié, ou le serveur ne répond pas. Réessayez, ou demandez un nouveau lien.",
  retry: "Réessayer",
  goHome: "Aller à l'accueil",
  loading: "Chargement du partage…",

  backToList: "Toute la liste",
  itemFrom: "Partagé par {{name}}",
  itemPreviewNote: "Aperçu partagé : la lecture demande un compte sur ce serveur.",
  signInToWatch: "Se connecter pour regarder",
  openDetail: "Ouvrir la fiche",
  trailers: "Bandes-annonces",
};
