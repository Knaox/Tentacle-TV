/**
 * Deleting titles from the library — web and desktop only
 * (docs/DROITS-UTILISATEURS.md § 9.7). Never read by mobile or TV.
 */
export default {
  // Selection mode
  select: "Select",
  selectHint: "Choose titles to delete from the library",
  done: "Done",
  escapeHint: "Esc to exit",
  selectedCount_one: "{{count}} title selected",
  selectedCount_other: "{{count}} titles selected",
  selectedNone: "No title selected",
  ofTotal_one: "of {{count}} title",
  ofTotal_other: "of {{count}} titles",
  selectAll: "Select all ({{count}})",
  deselectAll: "Deselect all",
  preparing: "Preparing the selection…",
  preparingFailed: "Couldn't tell which titles you can delete. Try again.",
  delete: "Delete…",
  notDeletable: "You can't delete this title",
  checkTitle: "Select “{{name}}”",
  searchCapped: "Only the first {{shown}} of {{total}} results are offered: refine your search to reach the others.",
  platformScope: "With a platform filter, “Select all” covers the titles shown.",
  nothingDeletable: "None of these titles can be deleted with your account.",

  // Confirmation
  confirmTitleOne: "Delete “{{name}}”?",
  confirmTitle_one: "Delete {{count}} title?",
  confirmTitle_other: "Delete {{count}} titles?",
  andMore_one: "and {{count}} more",
  andMore_other: "and {{count}} more",
  diskWarning: "The files will also be deleted from the server's disk. This can't be undone.",
  seriesNote: "A series takes all its seasons and episodes with it; a season, all its episodes.",
  cancel: "Cancel",
  confirm_one: "Delete",
  confirm_other: "Delete {{count}} titles",

  // Progress
  progressTitle: "Deleting…",
  progress: "{{done}} of {{total}}",
  progressHint: "Keep this window open until it's done.",
  stop: "Stop",
  stopping: "Stopping after this batch…",

  // Summary
  doneTitle: "Deletion complete",
  partialTitle: "Deletion incomplete",
  removed_one: "{{count}} title deleted.",
  removed_other: "{{count}} titles deleted.",
  removedNone: "No title was deleted.",
  gone_one: "{{count}} title was already gone from the library.",
  gone_other: "{{count}} titles were already gone from the library.",
  forbidden_one: "{{count}} title couldn't be deleted: Jellyfin doesn't allow you to.",
  forbidden_other: "{{count}} titles couldn't be deleted: Jellyfin doesn't allow you to.",
  failed_one: "{{count}} title couldn't be deleted: the server didn't respond.",
  failed_other: "{{count}} titles couldn't be deleted: the server didn't respond.",
  skipped_one: "{{count}} title wasn't processed: the deletion was stopped.",
  skipped_other: "{{count}} titles weren't processed: the deletion was stopped.",
  retry: "Retry these titles",
  close: "Close",

  // Detail page
  moreActions: "More actions",
  deleteFromLibrary: "Delete from library",
  deleteSeason: "Delete season",

  types: {
    Movie: "Movie",
    Series: "Series",
    Season: "Season",
    Episode: "Episode",
  },
} as const;
