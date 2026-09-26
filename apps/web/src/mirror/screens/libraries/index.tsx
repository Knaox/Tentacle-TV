import { useParams } from "react-router-dom";
import { LibrariesScreen } from "./LibrariesScreen";
import { LibraryCatalogScreen } from "./LibraryCatalogScreen";

/** Route `/libraries` — l'onglet Bibliothèque (bibliothèque choisie en `?lib=`). */
export function MirrorLibraries() {
  return <LibrariesScreen />;
}

/**
 * Route `/library/:libraryId` — une bibliothèque ouverte depuis ailleurs.
 * La clé remonte l'écran d'une bibliothèque à l'autre : recherche dépliée et
 * filtres repartent de zéro.
 */
export function MirrorLibraryCatalog() {
  const { libraryId } = useParams<{ libraryId: string }>();
  if (!libraryId) return null;
  return <LibraryCatalogScreen key={libraryId} libraryId={libraryId} />;
}
