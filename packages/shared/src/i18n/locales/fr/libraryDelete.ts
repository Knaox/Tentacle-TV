/**
 * Supprimer des titres de la bibliothèque — web et bureau seulement
 * (docs/DROITS-UTILISATEURS.md § 9.7). Jamais lu par le mobile ni les TV.
 */
export default {
  // Mode sélection
  select: "Sélectionner",
  selectHint: "Choisir des titres à supprimer de la bibliothèque",
  done: "Terminer",
  escapeHint: "Échap pour quitter",
  selectedCount_one: "{{count}} titre sélectionné",
  selectedCount_other: "{{count}} titres sélectionnés",
  selectedNone: "Aucun titre sélectionné",
  ofTotal_one: "sur {{count}} titre",
  ofTotal_other: "sur {{count}} titres",
  selectAll: "Tout sélectionner ({{count}})",
  deselectAll: "Tout désélectionner",
  preparing: "Préparation de la sélection…",
  preparingFailed: "Impossible de savoir quels titres vous pouvez supprimer. Réessayez.",
  delete: "Supprimer…",
  notDeletable: "Vous ne pouvez pas supprimer ce titre",
  checkTitle: "Sélectionner « {{name}} »",
  searchCapped: "Seuls les {{shown}} premiers résultats sont proposés sur {{total}} : affinez la recherche pour atteindre les autres.",
  platformScope: "Avec un filtre de plateforme, « Tout sélectionner » couvre les titres affichés.",
  nothingDeletable: "Aucun de ces titres ne peut être supprimé avec votre compte.",

  // Confirmation
  confirmTitleOne: "Supprimer « {{name}} » ?",
  confirmTitle_one: "Supprimer {{count}} titre ?",
  confirmTitle_other: "Supprimer {{count}} titres ?",
  andMore_one: "et {{count}} autre",
  andMore_other: "et {{count}} autres",
  diskWarning: "Les fichiers seront aussi supprimés du disque du serveur. C'est irréversible.",
  seriesNote: "Une série emporte toutes ses saisons et tous ses épisodes ; une saison, tous ses épisodes.",
  cancel: "Annuler",
  confirm_one: "Supprimer",
  confirm_other: "Supprimer {{count}} titres",

  // Progression
  progressTitle: "Suppression en cours…",
  progress: "{{done}} sur {{total}}",
  progressHint: "Gardez cette fenêtre ouverte jusqu'à la fin.",
  stop: "Arrêter",
  stopping: "Arrêt après ce lot…",

  // Bilan
  doneTitle: "Suppression terminée",
  partialTitle: "Suppression incomplète",
  removed_one: "{{count}} titre supprimé.",
  removed_other: "{{count}} titres supprimés.",
  removedNone: "Aucun titre n'a été supprimé.",
  gone_one: "{{count}} titre n'était déjà plus dans la bibliothèque.",
  gone_other: "{{count}} titres n'étaient déjà plus dans la bibliothèque.",
  forbidden_one: "{{count}} titre n'a pas pu être supprimé : Jellyfin ne vous y autorise pas.",
  forbidden_other: "{{count}} titres n'ont pas pu être supprimés : Jellyfin ne vous y autorise pas.",
  failed_one: "{{count}} titre n'a pas pu être supprimé : le serveur n'a pas répondu.",
  failed_other: "{{count}} titres n'ont pas pu être supprimés : le serveur n'a pas répondu.",
  skipped_one: "{{count}} titre n'a pas été traité : la suppression a été arrêtée.",
  skipped_other: "{{count}} titres n'ont pas été traités : la suppression a été arrêtée.",
  deletedOne: "« {{name}} » a été supprimé de la bibliothèque.",
  retry: "Réessayer ces titres",
  close: "Fermer",

  // Fiche
  moreActions: "Plus d'actions",
  deleteFromLibrary: "Supprimer de la bibliothèque",
  deleteSeason: "Supprimer la saison",

  types: {
    Movie: "Film",
    Series: "Série",
    Season: "Saison",
    Episode: "Épisode",
  },
} as const;
