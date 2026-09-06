import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { isFamilyActive, toggleFamily, useSaveRecoProviderFilter } from "@tentacle-tv/api-client";
import type { PlatformCatalogEntry } from "@tentacle-tv/api-client";
import { BottomSheet, Button } from "@/components/ui";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { PlatformLogo } from "./PlatformLogo";

/** Le compte n'enregistre pas à chaque coche : un seul PUT par rafale. */
const SAVE_DEBOUNCE_MS = 400;

interface Props {
  visible: boolean;
  onClose: () => void;
  catalog: PlatformCatalogEntry[];
  /** Le filtre du compte (ids TMDB principaux) — la sélection en repart à l'ouverture. */
  providerFilter: readonly number[];
}

/**
 * Le filtre de plateformes de la page Pour vous, en feuille : les familles
 * connues (Netflix, Disney+…), multi-sélection, « Toutes les plateformes ».
 * La sélection est locale, sauvegardée au compte après un court délai — et
 * tout de suite à la fermeture, pour que le dernier tap ne se perde jamais.
 */
export function RecoFilterSheet({ visible, onClose, catalog, providerFilter }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const save = useSaveRecoProviderFilter();
  const [selected, setSelected] = useState<number[]>([...providerFilter]);
  const debounced = useDebouncedCallback((ids: number[]) => save.mutate(ids), SAVE_DEBOUNCE_MS);

  // À l'ouverture, on repart du compte (un autre appareil a pu le changer).
  useEffect(() => {
    if (visible) setSelected([...providerFilter]);
  }, [visible, providerFilter]);

  const toggle = useCallback((entry: PlatformCatalogEntry) => {
    setSelected((prev) => {
      const next = toggleFamily(prev, entry);
      debounced.call(next);
      return next;
    });
  }, [debounced]);
  const clear = useCallback(() => {
    setSelected([]);
    debounced.call([]);
  }, [debounced]);
  const close = useCallback(() => {
    debounced.flush();
    onClose();
  }, [debounced, onClose]);

  return (
    <BottomSheet visible={visible} onClose={close} snapPoints={[0.7, 0.95]}>
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <Text style={st.title}>{t("filtersPlatformsLabel")}</Text>
        <View style={st.grid} accessibilityRole="list">
          {catalog.map((entry) => {
            const active = isFamilyActive(entry, selected);
            return (
              <Pressable
                key={entry.key}
                onPress={() => toggle(entry)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={entry.label}
                style={({ pressed }) => [st.cell, active && st.cellActive, pressed && st.pressed]}
              >
                <PlatformLogo logoPath={entry.logoPath} label={entry.label} />
                <Text style={[st.cellTxt, active && st.cellTxtActive]} numberOfLines={1}>{entry.label}</Text>
                {active && <Feather name="check" size={16} color={theme.colors.brand.light} />}
              </Pressable>
            );
          })}
        </View>
        <Button
          title={t("providersAll")}
          variant="ghost"
          onPress={clear}
          disabled={selected.length === 0}
          style={st.all}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary, letterSpacing: 0.8, textTransform: "uppercase" as const },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  cell: {
    width: "48%" as const, minHeight: 48,
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: "transparent",
    backgroundColor: t.colors.fill.faint,
  },
  cellActive: { backgroundColor: t.colors.brand.soft, borderColor: t.colors.brand.glow },
  pressed: { opacity: 0.85 },
  cellTxt: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, flex: 1 },
  cellTxtActive: { color: t.colors.brand.light, fontFamily: FONT_FAMILY.semibold },
  all: { alignSelf: "flex-start" as const },
});
