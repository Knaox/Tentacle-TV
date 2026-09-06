import { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import {
  mergeHiddenHomeRows, reconcileHomeRows, useMediaItem, useSaveHomeLayoutPatch, visibleHomeRows,
} from "@tentacle-tv/api-client";
import type { CardDensity, HeroMode, HomeLayoutData, HomeRowDescriptor } from "@tentacle-tv/api-client";
import { SettingsSection, SettingsRow, SegmentedChoice } from "@/components/settings";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { FavoritePickerSheet } from "./FavoritePickerSheet";
import { HomeRowsEditor } from "./HomeRowsEditor";
import { homeRowLabel } from "./homeRowLabel";

interface Props {
  layout: HomeLayoutData;
  libraries: ReadonlyArray<{ Id: string; Name: string }>;
}

/**
 * Section « Accueil » : mode du bandeau (titre fixe choisi dans les
 * favoris), densité des cartes, ordre et activation des rangées. Chaque
 * changement relit le serveur et n'écrit que lui ; les rangées se patchent
 * PAR CLÉ sur la copie fraîche, réconciliée avec les bibliothèques.
 */
export function PersonalizationHomeSection({ layout, libraries }: Props) {
  const { t } = useTranslation("preferences");
  const { t: tCommon } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const st = useThemedStyles(makeStyles);
  const libs = useMemo(() => libraries.map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const librariesById = useMemo(() => new Map(libraries.map((l) => [l.Id, l.Name])), [libraries]);
  const save = useSaveHomeLayoutPatch({ libraries: libs });
  const fixed = useMediaItem(layout.heroMode === "fixed" ? (layout.heroFixedItemId ?? undefined) : undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  // La liste VISIBLE que l'éditeur manipule — même réconciliation que l'accueil.
  const editorRows = useMemo(
    () => visibleHomeRows(
      reconcileHomeRows(layout.rows, libs, { anchorNewLibraries: layout.stored === false, catalog: layout.catalog }),
      layout.catalog,
    ),
    [layout, libs],
  );
  const labelFor = useCallback((key: string) => homeRowLabel(key, { tCommon, tReco, librariesById }), [tCommon, tReco, librariesById]);
  // Les rangées cachées reprennent leur place derrière celles que l'éditeur a
  // ordonnées — sur la copie FRAÎCHE (un autre appareil a pu bouger entre-temps).
  const changeRows = useCallback((next: HomeRowDescriptor[]) => {
    save.mutate((fresh) => ({ rows: mergeHiddenHomeRows(fresh.rows, next, fresh.catalog) }));
  }, [save]);

  const heroOptions = [
    { value: "resume", label: t("persoHeroResume") },
    { value: "random", label: t("persoHeroRandom") },
    { value: "reco", label: t("persoHeroReco") },
    { value: "fixed", label: t("persoHeroFixed") },
  ];
  const densityOptions = [
    { value: "compact", label: t("persoDensityCompact") },
    { value: "normal", label: t("persoDensityNormal") },
    { value: "large", label: t("persoDensityLarge") },
  ];

  return (
    <SettingsSection title={t("persoHomeTitle")} caption={t("persoHomeCaption")}>
      <View style={st.block}>
        <Text style={st.label}>{t("persoHeroMode")}</Text>
        <SegmentedChoice
          wrap
          options={heroOptions}
          value={layout.heroMode}
          onChange={(heroMode) => save.mutate({ heroMode: heroMode as HeroMode })}
          accessibilityLabel={t("persoHeroMode")}
        />
      </View>
      {layout.heroMode === "fixed" && (
        <SettingsRow
          icon="bookmark"
          label={t("persoHeroFixed")}
          value={fixed.data?.Name ?? t("persoHeroFixedNone")}
          chevron
          onPress={() => setPickerOpen(true)}
        />
      )}
      <View style={st.block}>
        <Text style={st.label}>{t("persoDensity")}</Text>
        <SegmentedChoice
          options={densityOptions}
          value={layout.cardDensity}
          onChange={(cardDensity) => save.mutate({ cardDensity: cardDensity as CardDensity })}
          accessibilityLabel={t("persoDensity")}
        />
      </View>
      <View style={[st.block, st.last]}>
        <Text style={st.label}>{t("persoRowsTitle")}</Text>
        <Text style={st.hint}>{t("persoRowsHintMobile")}</Text>
        <HomeRowsEditor rows={editorRows} labelFor={labelFor} onChange={changeRows} />
      </View>
      <FavoritePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={layout.heroFixedItemId}
        onSelect={(id) => save.mutate({ heroFixedItemId: id })}
      />
    </SettingsSection>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  block: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
  last: { borderBottomWidth: 0 },
  label: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  hint: { ...typography.caption, color: t.colors.text.tertiary, marginBottom: spacing.xs },
});
