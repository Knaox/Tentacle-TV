import { memo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone, X } from "lucide-react-native";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Le compte est dans un groupe, mais par un AUTRE appareil : l'adhésion est
 * par appareil, celui-ci ignore la salle. Il n'en dit qu'une ligne —
 * « Groupe en cours sur un autre appareil » — et propose « Rejoindre ici »
 * (AJOUTE cet appareil, l'autre reste). Masquable pour la session.
 */
export const WtElsewhereBanner = memo(function WtElsewhereBanner({ hostUsername, memberCount, onJoinHere, onDismiss }: {
  hostUsername: string;
  memberCount: number;
  onJoinHere: () => Promise<void>;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState(false);

  const join = (): void => {
    setJoining(true);
    setFailed(false);
    onJoinHere().then(() => setJoining(false), () => { setJoining(false); setFailed(true); });
  };

  return (
    <View style={s.banner} accessibilityRole="summary" testID="wt-elsewhere">
      <MonitorSmartphone size={22} color={theme.colors.brand.light} />
      <View style={s.text}>
        <Text style={s.title}>{t("elsewhereNotice")}</Text>
        <Text style={s.hint} numberOfLines={1}>
          {failed ? t("errorGeneric") : t("elsewhereHint", { host: hostUsername, count: memberCount })}
        </Text>
      </View>
      <Pressable onPress={join} disabled={joining} accessibilityRole="button" style={s.join} testID="wt-join-here">
        {joining
          ? <ActivityIndicator size="small" color={theme.colors.cta.brandFg} />
          : <Text style={s.joinLabel}>{t("joinHere")}</Text>}
      </Pressable>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={t("close")} hitSlop={8} style={s.close}>
        <X size={18} color={theme.colors.text.tertiary} />
      </Pressable>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: RADIUS.xl,
    backgroundColor: t.colors.glass.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
  text: { flex: 1, minWidth: 0 },
  title: { color: t.colors.text.primary, fontSize: 15, fontFamily: FONT_FAMILY.semibold },
  hint: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular },
  join: {
    minHeight: 44, minWidth: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill,
    alignItems: "center", justifyContent: "center", backgroundColor: t.colors.cta.brandBg,
  },
  joinLabel: { color: t.colors.cta.brandFg, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  close: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
});
