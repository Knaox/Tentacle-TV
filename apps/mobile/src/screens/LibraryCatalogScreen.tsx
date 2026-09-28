import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { SubtleBackground } from "@/components/ui";
import { LibraryCatalogView } from "@/components/library/LibraryCatalogView";
import { FLOATING_BACK_SIZE, FloatingBackButton } from "@/components/navigation/FloatingBackButton";
import { backOrHome } from "@/utils/backOrHome";
import { spacing } from "@/theme";

interface Props { libraryId: string; libraryName?: string }

/**
 * Une bibliothèque, ouverte depuis ailleurs (accueil, lien) : la même vue que
 * l'onglet Bibliothèque — héros, recherche, barre rapide, grille —, sans la
 * capsule, avec un bouton retour flottant qui reste à portée du pouce pendant
 * tout le défilement (le même que Ma liste et Mes favoris).
 *
 * Tant que la liste des bibliothèques n'a pas répondu, le héros se contente
 * du nom passé par la route : la grille, elle, n'attend pas.
 */
export function LibraryCatalogScreen({ libraryId, libraryName }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: libraries } = useLibraries();
  const library = useMemo<LibraryView>(
    () => libraries?.find((lib) => lib.Id === libraryId)
      ?? ({ Id: libraryId, Name: libraryName ?? "" } as LibraryView),
    [libraries, libraryId, libraryName],
  );
  const top = Math.max(insets.top, 24);

  return (
    <SubtleBackground ambient>
      <LibraryCatalogView
        library={library}
        topInset={top}
        bottomInset={insets.bottom}
        searchDockOffset={FLOATING_BACK_SIZE + spacing.sm}
      />
      <FloatingBackButton top={top} onPress={() => backOrHome(router)} />
    </SubtleBackground>
  );
}
