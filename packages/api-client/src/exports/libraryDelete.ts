// Supprimer des titres de la bibliothèque (web, bureau) — capacité `library.delete`.
// Contrat : @tentacle-tv/shared › libraryDelete/ (docs/DROITS-UTILISATEURS.md § 9.7).
export {
  LIBRARY_DELETION_RIGHTS_KEY, fetchLibraryDeletionRights, postLibraryDeletion, useLibraryDeletionRights,
} from "../libraryDelete/libraryDeleteApi";
export {
  DELETABLE_INDEX_KEY, useLibraryDeletableIndex, useDeletableEntries,
  type DeletableEntry, type DeletableIndex,
} from "../libraryDelete/deletableIndex";
export { forgetDeletedItems } from "../libraryDelete/deletionCache";
export { useLibraryDeletion, type DeletionRunState, type DeletionRunSummary } from "../libraryDelete/useLibraryDeletion";
