import { memo } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, spacing, typography } from "@/theme";

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

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: spacing.xs },
  chip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.caption, color: colors.textSecondary, lineHeight: 16 },
  chipTextActive: { color: colors.textPrimary, fontWeight: "600" },
});
