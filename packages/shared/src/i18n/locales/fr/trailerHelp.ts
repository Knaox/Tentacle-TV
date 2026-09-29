/**
 * Le guide « Bandes-annonces » — pourquoi une fiche n'en montre pas, et quoi
 * faire — et le rappel discret des fiches qui y mène. Les MOTS du guide ; sa
 * structure (l'ordre des étapes, leurs liens) vit dans
 * `packages/shared/src/help/trailerGuide.ts`. Une seule source pour le web, le
 * bureau, le miroir, le mobile et les téléviseurs.
 *
 * Les libellés de Jellyfin sont cités tels que son interface les affiche
 * (relevés dans jellyfin-web 10.11 et 12.1, identiques) : « Médiathèques »,
 * « Gérer la médiathèque », « Sources de métadonnées », « Actualiser les
 * métadonnées », « Rechercher les métadonnées manquantes », « Extensions ».
 *
 * ⚠️ Lu aussi par le MOBILE : jamais « téléchargement » ni « download » ici
 * (garde-fou : `trailerHelpVocabulary.test.ts`). Espaces insécables (\u00a0)
 * devant « ? », « : » et « % » : sur un téléphone, le rappel passe à la ligne,
 * jamais devant sa ponctuation.
 */
export default {
  // ── Le rappel de la fiche ──────────────────────────────────────────────
  hintLink: "Vous ne voyez pas les bandes-annonces\u00a0?",
  hintHide: "Ne plus afficher ce rappel",
  hintHidden: "Rappel masqué. Le guide reste dans Aide › Bandes-annonces.",
  hintUndo: "Annuler",
  // Les téléviseurs : pas de lien à suivre à la télécommande, une phrase qui renvoie ailleurs.
  hintTv: "Vous ne voyez pas les bandes-annonces\u00a0? Le guide est dans l'app Tentacle, sur le web ou le téléphone\u00a0: Aide › Bandes-annonces.",

  // ── L'entrée dans l'aide ───────────────────────────────────────────────
  helpGuidesTitle: "Guides",
  helpEntryTitle: "Bandes-annonces",
  helpEntryBody: "Pourquoi certaines fiches n'en ont pas, et quoi faire.",

  // ── En-tête du guide ───────────────────────────────────────────────────
  title: "Bandes-annonces",
  lead: "Pourquoi certaines fiches n'en ont pas, et comment les faire apparaître.",
  back: "Retour",
  partEveryone: "Pour tous",
  partAdmin: "Pour l'administrateur",
  contentsLabel: "Sommaire",

  // ── Pour tous ──────────────────────────────────────────────────────────
  notYouTitle: "Ce n'est pas vous",
  notYouBody: "Tentacle montre les bandes-annonces que connaît votre serveur Jellyfin. Quand un titre n'en a aucune, le bouton «\u00a0Bande-annonce\u00a0» n'apparaît pas sur sa fiche\u00a0: ni votre appareil ni l'application ne sont en cause.",
  sourcesTitle: "D'où elles viennent",
  sourceLocalTitle: "Un fichier du serveur",
  sourceLocalBody: "Une bande-annonce que l'administrateur a posée à côté du film. Elle passe en premier, dans le lecteur de Tentacle.",
  sourceRemoteTitle: "Une vidéo YouTube",
  sourceRemoteBody: "Trouvée par Jellyfin dans TheMovieDb, la grande base de données des films et des séries, si le serveur est réglé pour la chercher.",
  whatToDoTitle: "Que faire\u00a0?",
  whatToDoBody: "Tout se règle sur le serveur\u00a0: demandez à son administrateur. La marche à suivre est juste en dessous, vous pouvez la lui transmettre.",
  whatToDoAdmin: "Vous êtes l'administrateur\u00a0: la marche à suivre est pour vous.",
  whatToDoAdminLink: "Voir la marche à suivre",
  notesTitle: "Bon à savoir",
  noteRare: "Même sur un serveur bien réglé, certains titres n'ont pas de bande-annonce\u00a0: TheMovieDb n'en connaît pas pour tous.",
  notePhone: "Sur le téléphone, une bande-annonce YouTube s'ouvre dans l'app YouTube ou dans le navigateur.",
  noteAppleTv: "Sur l'Apple TV, les bandes-annonces YouTube passent par le serveur Tentacle. Si elles refusent de démarrer, c'est lui qu'il faut mettre à jour.",

  // ── L'état du serveur, mesuré ──────────────────────────────────────────
  statusTitle: "Sur ce serveur",
  statusReady: "Les bandes-annonces sont bien réglées\u00a0: un titre qui n'en a pas n'en a simplement pas.",
  statusMisconfigured: "Les bandes-annonces YouTube ne sont pas encore réglées.",
  reasonTmdbPluginDisabled: "L'extension TMDb est désactivée dans Jellyfin.",
  reasonTmdbFetcherDisabled: "TheMovieDb n'est pas coché dans toutes les médiathèques de films et de séries.",
  reasonFewTrailers: "Seuls {{percent}}\u00a0% des titres connus de TheMovieDb ont une bande-annonce\u00a0: les métadonnées n'ont sans doute pas été actualisées.",
  statusCheckedAt: "Mesuré à {{time}}",

  // ── Pour l'administrateur ──────────────────────────────────────────────
  adminLead: "Les deux premières étapes suffisent le plus souvent. Les suivantes complètent.",
  optional: "Facultatif",
  stepLabel: "Étape {{number}}",
  stepTmdbTitle: "Activez TheMovieDb dans Jellyfin",
  stepTmdbLibraries: "Dans le tableau de bord de Jellyfin, ouvrez «\u00a0Médiathèques\u00a0». Pour chaque médiathèque de films et de séries\u00a0: «\u00a0Gérer la médiathèque\u00a0», puis cochez «\u00a0TheMovieDb\u00a0» dans chaque «\u00a0Sources de métadonnées\u00a0» affichée, et enregistrez.",
  stepTmdbPlugin: "Vérifiez aussi, dans «\u00a0Extensions\u00a0», que l'extension TMDb, livrée avec Jellyfin, est active.",
  stepRefreshTitle: "Actualisez les métadonnées",
  stepRefreshHow: "Toujours dans «\u00a0Médiathèques\u00a0», ouvrez le menu de chaque médiathèque\u00a0: «\u00a0Actualiser les métadonnées\u00a0», mode «\u00a0Rechercher les métadonnées manquantes\u00a0», puis «\u00a0Actualiser\u00a0». Jellyfin va chercher les bandes-annonces des titres déjà présents\u00a0; ceux qui arrivent ensuite les reçoivent d'eux-mêmes.",
  stepRefreshTentacle: "La vue d'ensemble de l'administration de Tentacle propose aussi ce geste, en un clic.",
  stepLocalTitle: "Ajoutez vos propres bandes-annonces",
  stepLocalHow: "Posez le fichier à côté du film, nommé comme lui avec «\u00a0-trailer\u00a0», ou rangez-le dans un sous-dossier «\u00a0trailers\u00a0». Jellyfin le trouve au prochain scan, et Tentacle le lit en priorité, dans son propre lecteur.",
  stepLocalExample: "Films/Dune (2021)/Dune (2021).mkv\nFilms/Dune (2021)/Dune (2021)-trailer.mp4\nFilms/Dune (2021)/trailers/Bande-annonce VF.mp4",
  stepLocalSeries: "Pour une série, le sous-dossier «\u00a0trailers\u00a0» se range dans le dossier de la série.",
  stepJellyseerrTitle: "Branchez Jellyseerr",
  stepJellyseerrBody: "Avec l'extension Vigie reliée à Jellyseerr, Tentacle complète la liste avec toutes les vidéos de TheMovieDb\u00a0: souvent la version française, quand Jellyfin n'a retenu que l'anglaise.",
  stepUpdateTitle: "Gardez Tentacle à jour",
  stepUpdateJellyfin12: "Jellyfin 12 a changé la façon dont les applications s'y connectent\u00a0: avec un serveur Tentacle trop ancien, plus rien ne passe, bandes-annonces comprises.",
  stepUpdateAppleTv: "Sur l'Apple TV, les bandes-annonces YouTube sont lues grâce à l'outil yt-dlp de l'image Docker de Tentacle. YouTube change souvent\u00a0: une image à jour les remet en route.",

  // ── Liens ──────────────────────────────────────────────────────────────
  linkJellyfinLibraries: "Médiathèques de Jellyfin",
  linkJellyfinPlugins: "Extensions de Jellyfin",
  linkJellyfinDocs: "Documentation de Jellyfin",
  linkAdminOverview: "Vue d'ensemble",
  linkAdminPlugins: "Extensions de Tentacle",
  linkAdminServices: "Services",
  linkOpensOutside: "s'ouvre hors de l'application",

  // ── Le rappel masqué ───────────────────────────────────────────────────
  hiddenNote: "Le rappel «\u00a0Vous ne voyez pas les bandes-annonces\u00a0?\u00a0» est masqué sur les fiches.",
  showAgain: "Le réafficher",
  shownAgain: "Le rappel réapparaîtra sur les fiches concernées.",
};
