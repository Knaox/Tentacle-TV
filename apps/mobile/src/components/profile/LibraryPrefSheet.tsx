import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { SubtitleMode } from "@tentacle-tv/offline-core";
import { BottomSheet } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { PREF_AUDIO_EXTRA, PREF_LANGUAGES, PREF_SUBTITLE_MODES, type LibraryPrefValues, type PrefChoice } from "./libraryPrefOptions";

interface Props {
  visible: boolean;
  onClose: () => void;
  libraryName: string;
  pref: LibraryPrefValues | null;
  /** Chaque choix part aussitôt : pas de bouton « Enregistrer » à chercher. */
  onSave: (values: LibraryPrefValues) => void;
}

const CHIP_HIT_SLOP = { top: 4, bottom: 4 } as const;

/**
 * Les langues d'une bibliothèque, dans une feuille : audio, sous-titres, mode
 * des sous-titres, en pastilles qui passent à la ligne (jamais un défilement
 * horizontal qui cache la moitié des langues). La feuille ne sait pas où
 * part l'enregistrement — le serveur en ligne, la file locale hors ligne —
 * c'est `onSave` qui décide.
 */
export function LibraryPrefSheet({ visible, onClose, libraryName, pref, onSave }: Props) {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  // Copie locale, semée à l'ouverture : la pastille s'allume sous le doigt
  // sans attendre l'aller-retour du serveur.
  const [draft, setDraft] = useState<LibraryPrefValues | null>(pref);
  useEffect(() => {
    if (visible) setDraft(pref);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- semée à l'ouverture seulement
  }, [visible, libraryName]);
  const current: LibraryPrefValues = draft ?? { audioLang: null, subtitleLang: null, subtitleMode: "none" };
  const patch = (next: Partial<LibraryPrefValues>) => {
    const values = { ...current, ...next };
    setDraft(values);
    onSave(values);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.7, 0.95]}>
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <Text style={st.heading} accessibilityRole="header">{libraryName}</Text>

        <Text style={st.label}>{t("audio")}</Text>
        <ChipGrid
          items={[{ code: "", labelKey: "default" }, ...PREF_AUDIO_EXTRA, ...PREF_LANGUAGES]}
          selected={current.audioLang ?? ""}
          onSelect={(code) => patch({ audioLang: code || null })}
          label={t("audio")}
        />

        <Text style={st.label}>{t("subtitles")}</Text>
        <ChipGrid
          items={[{ code: "", labelKey: "none" }, ...PREF_LANGUAGES]}
          selected={current.subtitleLang ?? ""}
          onSelect={(code) => patch({ subtitleLang: code || null })}
          label={t("subtitles")}
        />

        <Text style={st.label}>{t("subtitleMode")}</Text>
        <ChipGrid
          items={PREF_SUBTITLE_MODES}
          selected={current.subtitleMode}
          onSelect={(code) => patch({ subtitleMode: code as SubtitleMode })}
          label={t("subtitleMode")}
        />
      </ScrollView>
    </BottomSheet>
  );
}

function ChipGrid({ items, selected, onSelect, label }: {
  items: readonly PrefChoice[];
  selected: string;
  onSelect: (code: string) => void;
  label: string;
}) {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {items.map((item) => {
        const active = selected === item.code;
        return (
          <Pressable
            key={item.code || "none"}
            onPress={() => onSelect(item.code)}
            hitSlop={CHIP_HIT_SLOP}
            style={({ pressed }) => [st.chip, active && st.chipActive, pressed && st.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
          >
            <Text style={[st.chipText, active && st.chipTextActive]}>{t(item.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heading: { ...typography.subtitle, color: t.colors.text.primary, marginBottom: spacing.sm },
  label: {
    ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary,
    letterSpacing: 0.8, textTransform: "uppercase" as const, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.sm },
  // Le fond est posé dès le montage, actif ou non : Fabric Android perd le
  // rayon d'une vue dont le fond n'apparaît qu'à l'activation.
  chip: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center" as const,
    backgroundColor: t.colors.fill.subtle, borderWidth: 1, borderColor: t.colors.border.subtle,
  },
  chipActive: { backgroundColor: t.colors.brand.soft, borderColor: t.colors.brand.glow },
  pressed: { transform: [{ scale: 0.97 }] },
  chipText: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  chipTextActive: { fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
});
