import { useCallback, useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  mergeHiddenHomeRows, reconcileHomeRows, useHomeLayout, useLibraries, useSaveHomeLayoutPatch, visibleHomeRows,
  type HomeRowDescriptor,
} from "@tentacle-tv/api-client";
import { HomeRowsEditor } from "@/components/settings/personalization/HomeRowsEditor";
import { homeRowLabel } from "@/components/settings/personalization/homeRowLabel";
import { spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * L'étape « Votre accueil » : les rangées de l'accueil et leur ordre — la
 * préférence du COMPTE sur le serveur (`/api/preferences/home-layout`), celle
 * que le web, le bureau et Réglages › Accueil éditent : même accueil partout.
 * Même éditeur et même réconciliation que Réglages (`HomeRowsEditor`) ; chaque
 * geste se patche PAR CLÉ sur la copie fraîche du serveur.
 */
export function HomeRowsStep() {
  const { t } = useTranslation("familyMobile");
  const { t: tCommon } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { data: layout, isError } = useHomeLayout();
  const { data: libraries } = useLibraries();
  const libs = useMemo(() => (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const librariesById = useMemo(() => new Map((libraries ?? []).map((l) => [l.Id, l.Name])), [libraries]);
  const save = useSaveHomeLayoutPatch({ libraries: libs });

  const rows = useMemo(
    () => (layout
      ? visibleHomeRows(reconcileHomeRows(layout.rows, libs, { anchorNewLibraries: layout.stored === false, catalog: layout.catalog }), layout.catalog)
      : []),
    [layout, libs],
  );
  const labelFor = useCallback((key: string) => homeRowLabel(key, { tCommon, tReco, librariesById }), [tCommon, tReco, librariesById]);
  const change = useCallback((next: HomeRowDescriptor[]) => {
    save.mutate((fresh) => ({ rows: mergeHiddenHomeRows(fresh.rows, next, fresh.catalog) }));
  }, [save]);

  if (isError) return <Text style={st.note}>{t("firstRun.homeUnavailable")}</Text>;
  if (!layout || !libraries) {
    return (
      <View style={st.loading}>
        <ActivityIndicator color={theme.colors.text.secondary} />
        <Text style={st.note}>{t("firstRun.homeLoading")}</Text>
      </View>
    );
  }
  return (
    <View style={st.editor}>
      <HomeRowsEditor rows={rows} labelFor={labelFor} onChange={change} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    editor: {
      width: "100%",
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    loading: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
    note: { ...typography.body, color: t.colors.text.secondary, textAlign: "center" },
  });
