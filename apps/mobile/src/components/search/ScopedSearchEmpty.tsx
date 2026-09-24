import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTentacleSearch } from "@tentacle-tv/api-client";
import { foldForSearch, type ExternalKind } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ExternalSections } from "./SearchExternal";
import { useMobileExternalSearch } from "./useMobileExternalSearch";
import { useSearchNavigation } from "./useSearchNavigation";

interface Props {
  query: string;
  /** Remplace la recherche locale par la correction proposée. */
  onApply: (term: string) => void;
  /** Hors bibliothèque, seulement ce type (une bibliothèque de films → des films). */
  kind?: ExternalKind | null;
  /** Ma liste, Mes favoris : ce qui n'est pas sur le serveur n'y a pas sa place. */
  external?: boolean;
}

/**
 * Quand une recherche LOCALE (bibliothèque, Ma liste, Mes favoris) ne rend
 * rien — les sorties utiles du bureau 1.22.0, jamais une impasse :
 *
 * - « Essayer « dune » » : la correction du MOTEUR de Tentacle, qui tolère les
 *   fautes (Jellyfin compare lettre à lettre), appliquée sur place ;
 * - « Chercher dans tout Tentacle » : la même requête dans la recherche, qui
 *   voit toutes les bibliothèques, les personnes, les genres ;
 * - ce que les extensions trouvent hors de la bibliothèque (« Pas encore sur
 *   le serveur · via Vigie »).
 *
 * Le moteur n'est interrogé qu'à partir de trois lettres, une fois par texte.
 */
export const ScopedSearchEmpty = memo(function ScopedSearchEmpty({ query, onApply, kind = null, external = true }: Props) {
  const { t } = useTranslation("common");
  const { t: ts } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const nav = useSearchNavigation({ modal: false });
  const q = query.trim();
  const { data } = useTentacleSearch(q, { limit: 1, enabled: q.length >= 3 });
  const correction = data?.correction && foldForSearch(data.correction) !== foldForSearch(q) ? data.correction : null;
  const outside = useMobileExternalSearch(q, { kind, limit: 10, enabled: external });

  return (
    <View style={st.root}>
      <View style={st.box}>
        <Feather name="search" size={28} color={theme.colors.text.quaternary} />
        <Text style={st.title}>{ts("noLibraryResults", { query: q })}</Text>
        <View style={st.actions}>
          {correction !== null && (
            <Pressable onPress={() => onApply(correction)} accessibilityRole="button" style={({ pressed }) => [st.cta, st.primary, pressed && st.pressed]}>
              <Feather name="edit-3" size={15} color={theme.colors.cta.primaryFg} />
              <Text style={st.primaryTxt}>{t("tryCorrection", { term: correction })}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push({ pathname: "/search", params: { q } })}
            accessibilityRole="button"
            style={({ pressed }) => [st.cta, correction === null ? st.primary : st.secondary, pressed && st.pressed]}
          >
            <Feather name="search" size={15} color={correction === null ? theme.colors.cta.primaryFg : theme.colors.text.primary} />
            <Text style={correction === null ? st.primaryTxt : st.secondaryTxt}>{t("searchEverywhere")}</Text>
          </Pressable>
        </View>
      </View>
      {external && outside.results.length > 0 && (
        <ExternalSections results={outside.results} onOpen={nav.openExternalItem} onSeeAll={nav.openExternal} />
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { paddingBottom: spacing.xl },
    box: { alignItems: "center" as const, gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
    title: { fontSize: 16, lineHeight: 22, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, textAlign: "center" as const },
    actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "center" as const, gap: 8, marginTop: spacing.sm },
    cta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7, minHeight: 44, paddingHorizontal: 18, borderRadius: RADIUS.pill },
    primary: { backgroundColor: t.colors.cta.primaryBg },
    primaryTxt: { fontSize: 14, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg },
    secondary: { backgroundColor: t.colors.fill.soft, borderWidth: 1, borderColor: t.colors.border.subtle },
    secondaryTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    pressed: { opacity: 0.75 },
  });
