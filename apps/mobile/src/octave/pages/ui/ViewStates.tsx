/**
 * Octave mobile — les états d'une page : vide (une icône, une phrase, une
 * action), erreur (réessayer), et l'attente d'une liste de titres (rangées à
 * leur place). Jamais un écran blanc.
 */

import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RotateCw, type LucideIcon } from "lucide-react-native";
import { Skeleton } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { TRACK_ROW_HEIGHT } from "./TrackRow";
import { accentTextOf } from "./pageStyle";
import { OctaveBrandFill } from "../../layout/OctaveBrandFill";
import { useOctaveColors } from "../../theme/octaveColors";

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.badge, { backgroundColor: theme.colors.brand.soft }]}>
        <Icon size={26} color={accentTextOf(theme)} />
      </View>
      <Text style={[typography.subtitle, { color: theme.colors.text.primary, textAlign: "center" }]}>{title}</Text>
      {hint ? <Text style={[typography.body, { color: theme.colors.text.tertiary, textAlign: "center" }]}>{hint}</Text> : null}
      {action}
    </View>
  );
}

export function PillButton({ label, onPress, icon: Icon }: { label: string; onPress: () => void; icon?: LucideIcon }) {
  const colors = useOctaveColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.pill}>
      {({ pressed }) => (
        <>
          <OctaveBrandFill radius={22} pressed={pressed} />
          {Icon ? <Icon size={16} color={colors.onBrandFill} /> : null}
          <Text style={[typography.bodyBold, { color: colors.onBrandFill }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = useTranslation("music");
  return <EmptyState icon={RotateCw} title={message ?? t("common.error")} action={<PillButton label={t("common.retry")} onPress={onRetry} icon={RotateCw} />} />;
}

export function TrackRowsSkeleton({ count = 8, gutter }: { count?: number; gutter: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.row, { paddingHorizontal: gutter }]}>
          <Skeleton width={44} height={44} radius={6} />
          <View style={styles.rowText}>
            <Skeleton width="60%" height={13} radius={4} />
            <Skeleton width="38%" height={11} radius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: 12, paddingHorizontal: 32, paddingVertical: 48 },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, marginTop: 8 },
  row: { height: TRACK_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, gap: 6 },
});
