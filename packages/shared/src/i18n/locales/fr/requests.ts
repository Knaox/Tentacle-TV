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
};
