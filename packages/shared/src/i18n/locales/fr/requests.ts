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
};
