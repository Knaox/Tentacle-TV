import { memo } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { spacing, typography, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

const STATUS_OPTIONS = [
  { labelKey: "allStatus", value: null },
  { labelKey: "unwatched", value: "IsUnplayed" },
  { labelKey: "inProgress", value: "IsResumable" },
] as const;

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

export const StatusFilter = memo(function StatusFilter({ value, onChange }: Props) {
  const { t } = useTranslation("common");
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.container}>
      {STATUS_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <Pressable
            key={opt.labelKey}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {t(opt.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flexDirection: "row", gap: spacing.xs },
  chip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: t.colors.surface.s2,
    borderWidth: 1,
    borderColor: t.colors.brand.soft,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  chipActive: { backgroundColor: t.colors.brand.soft, borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow) },
  chipText: { ...typography.caption, color: t.colors.text.secondary, lineHeight: 16 },
  chipTextActive: { color: t.colors.brand.light, fontWeight: "600" },
});
