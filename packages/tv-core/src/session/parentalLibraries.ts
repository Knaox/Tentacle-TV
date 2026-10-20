/**
 * Les bibliothèques du contrôle parental simplifié : la règle vit dans shared
 * (`family/familyParentalLibraries.ts`), partagée avec le mobile — ré-exportée
 * ici pour que la TV garde ses imports.
 */
export {
  parentalLibraryRows, toggleParentalLibrary, parentalLibrariesCount,
  type ParentalLibraryOption, type ParentalLibraryRow, type ParentalLibrariesToggle,
} from "@tentacle-tv/shared";
