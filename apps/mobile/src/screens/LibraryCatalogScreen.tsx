import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { SubtleBackground } from "@/components/ui";
import { LibraryCatalogView } from "@/components/library/LibraryCatalogView";
import { backOrHome } from "@/utils/backOrHome";
import { RADIUS, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props { libraryId: string; libraryName?: string }

/**
 * Une bibliothèque, ouverte depuis ailleurs (accueil, lien) : la même vue que
 * l'onglet Bibliothèque — héros, recherche, barre rapide, grille —, sans la
 * capsule, avec un bouton retour flottant qui reste à portée du pouce pendant
 * tout le défilement.
 *
 * Tant que la liste des bibliothèques n'a pas répondu, le héros se contente
 * du nom passé par la route : la grille, elle, n'attend pas.
 */
export function LibraryCatalogScreen({ libraryId, libraryName }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
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
      <LibraryCatalogView library={library} topInset={top} bottomInset={insets.bottom} />
      <View style={[st.backWrap, { top: top + spacing.xs }]} pointerEvents="box-none">
        <Pressable
          onPress={() => backOrHome(router)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          style={({ pressed }) => [st.back, pressed && st.pressed]}
        >
          <Feather name="chevron-left" size={24} color={colors.text.primary} />
        </Pressable>
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  backWrap: { position: "absolute", left: spacing.screenPadding - 4 },
  // Pas de flou : la grille défile dessous, un flou y serait recalculé à
  // chaque image. Un aplat translucide et un liseré suffisent à le détacher.
  back: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(t.colors.surface.s0, 0.72, t.colors.surface.s0),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.strong,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
