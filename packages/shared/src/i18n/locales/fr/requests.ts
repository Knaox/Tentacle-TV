/**
 * Les titres que le compte attend d'une extension de demandes (contrat
 * `titles.mine`, cf. `search/pluginTitlesMine.ts`) : leurs états, une seule
 * source pour toute carte ou liste qui les dit.
 *
 * « Téléchargement » n'entre pas ici, dans aucune langue
 * (`requestsVocabulary.test.ts`) : les relecteurs d'Apple ouvrent ces écrans
 * et y liraient une distribution de contenu hors boutique.
 */
export default {
  // Pas encore validée.
  statePending: "En attente",
  // En route : l'avancement suit (`percent`).
  stateArriving: "En cours",
  // Le fichier est là : il est rangé dans la bibliothèque.
  stateImporting: "Mise en bibliothèque",
  // N'avance plus pour l'instant — jamais un échec.
  stateBlocked: "Bloquée",
  // Apple TV : le titre vient d'entrer dans la bibliothèque — son affiche
  // reprend toute sa couleur, puis la demande quitte la liste.
  stateArrived: "Disponible",
  percent: "{{percent}} %",
  // La liste des demandes en cours (TV) : l'entrée du rail et sa fenêtre.
  dockLabel: "Mes demandes",
  dockEmpty: "Rien en file d'attente",
  count_one: "{{count}} demande",
  count_other: "{{count}} demandes",
  empty: "Vous n'avez rien en file d'attente.",
  loading: "Chargement…",
  // « Saisons 1–4 et 6 » : les morceaux viennent de `seasonRuns`.
  seasons_one: "Saison {{list}}",
  seasons_other: "Saisons {{list}}",
  and: "et",

  // Apple TV — demander un titre absent de la bibliothèque (collection,
  // recherche, feuille des saisons).
  followOnPhone: "Pour suivre son état, ouvrez Tentacle sur votre téléphone.",
  hintRequest: "OK : demander",
  hintSeasons: "OK : choisir les saisons",
  searchRow: "À demander",
  seasonsSubtitle: "Cochez les saisons à demander.",
  seasonsSubmit_one: "Demander {{count}} saison",
  seasonsSubmit_other: "Demander {{count}} saisons",
  seasonFallback: "Saison {{number}}",
  // Apple TV : le nom d'une saison dans les mots de l'interface — « Spéciaux »
  // pour la saison 0, et son vrai nom à la suite s'il en a un (tv-core `seasonTitle`).
  seasonSpecials: "Spéciaux",
  seasonNamed: "{{season}} · {{name}}",
  seasonEpisodes_one: "{{count}} épisode",
  seasonEpisodes_other: "{{count}} épisodes",
  seasonsLoading: "Lecture des saisons…",
  seasonsFailed: "Les saisons ne se lisent pas pour l'instant. Réessayez plus tard.",
  seasonsNone: "Toutes ses saisons sont déjà là ou demandées.",

  // Une série de la bibliothèque à qui il manque des saisons (contrat
  // `titles.gaps`) : la recherche de toutes les plateformes, la fiche de la TV.
  missingSeasons_one: "{{count}} saison à demander",
  missingSeasons_other: "{{count}} saisons à demander",
  // L'action, quand le nombre ne se dit pas (bulle, lecteur d'écran).
  requestMissing: "Demander les saisons manquantes",
  // Une saison que la bibliothèque a déjà : jamais à cocher.
  seasonInLibrary: "Dans la bibliothèque",
  // Une saison manquante qui se demande encore (onglet de la fiche, TV).
  seasonToRequest: "À demander",
  // La pilule de la feuille, tant que rien n'est coché (désactivée).
  seasonsSubmitIdle: "Demander",
};
