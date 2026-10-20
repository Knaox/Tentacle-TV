import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { HeartHandshake, Inbox, Users } from "lucide-react-native";
import {
  dismissAffinityPill, openAffinity, useAffinityStore, useWatchTogetherOrIdle,
} from "@tentacle-tv/api-client";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { KIND_LABEL_KEY, memberName } from "@tentacle-tv/api-client";
import { WtElsewhereBanner } from "../room/WtElsewhereBanner";
import { openWtSheet } from "../wtSheets";
import { homeStripKind } from "./homeStripModel";

/**
 * La bande Watch Together de l'accueil — UNE ligne (`homeStripKind`) :
 * l'affinité à rejoindre, la lecture de groupe à rejoindre, le groupe,
 * les invitations reçues, ou le groupe sur un autre appareil. Le mobile n'a
 * pas d'icône d'en-tête pour le Watch Together : c'est elle qui le garde sous
 * la main. Rien hors Watch Together.
 */
export const WtHomeStrip = memo(function WtHomeStrip() {
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const router = useRouter();
  const wt = useWatchTogetherOrIdle();
  const { state: affinity, pillDismissed } = useAffinityStore();
  const [elsewhereDismissed, setElsewhereDismissed] = useState(false);
  const { room, selfId } = wt;

  const affinityInvite = !!affinity && !!room && pillDismissed !== affinity.sessionId
    && !affinity.participants.some((p) => p.userId === selfId);
  const kind = homeStripKind({
    inGroup: !!room, groupItemId: room?.itemId ?? null, affinityInvite,
    inviteCount: wt.invites.length, elsewhere: !!wt.elsewhere, elsewhereDismissed,
  });
  if (!kind) return null;

  if (kind === "elsewhere" && wt.elsewhere) {
    return (
      <View style={s.wrap}>
        <WtElsewhereBanner hostUsername={wt.elsewhere.hostUsername}
          onJoinHere={wt.actions.joinHere} onDismiss={() => setElsewhereDismissed(true)} />
      </View>
    );
  }

  const line = kind === "affinity" && affinity
    ? { icon: <HeartHandshake size={20} color={theme.colors.brand.light} />,
      text: t("affinityPillInvite", { name: memberName(room, affinity.startedBy), kind: t(KIND_LABEL_KEY[affinity.kind]) }),
      action: t("affinityJoin"), press: () => openAffinity("deck"), dismiss: () => dismissAffinityPill(affinity.sessionId) }
    : kind === "playing" && room?.itemId
      ? { icon: <Users size={20} color={theme.colors.brand.light} />, text: t("groupPlaybackActive"),
        action: t("rejoin"), press: () => router.push(`/watch/${room.itemId}`), secondary: () => openWtSheet("room") }
      : kind === "group"
        ? { icon: <Users size={20} color={theme.colors.brand.light} />, text: t("yourGroup"),
          action: t("openRoom"), press: () => openWtSheet("room") }
        : { icon: <Inbox size={20} color={theme.colors.brand.light} />, text: t("invitations"),
          action: String(wt.invites.length), press: () => openWtSheet("inbox") };

  return (
    <View style={s.wrap}>
      <View style={s.strip} testID={`wt-home-${kind}`}>
        <Pressable
          onPress={"secondary" in line && line.secondary ? line.secondary : line.press}
          accessibilityRole="button"
          style={({ pressed }) => [s.main, pressed && s.pressed]}
        >
          {line.icon}
          <Text style={s.text} numberOfLines={1}>{line.text}</Text>
        </Pressable>
        <Pressable onPress={line.press} accessibilityRole="button" style={s.action} hitSlop={6} testID="wt-home-action">
          <Text style={s.actionLabel}>{line.action}</Text>
        </Pressable>
        {"dismiss" in line && line.dismiss && (
          <Pressable onPress={line.dismiss} accessibilityRole="button" style={s.dismiss}>
            <Text style={s.dismissLabel}>{t("affinityDismiss")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrap: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.sm, alignItems: "center" },
  strip: {
    width: "100%", maxWidth: 640, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52,
    paddingLeft: 14, paddingRight: 6, borderRadius: RADIUS.pill, backgroundColor: t.colors.glass.panel,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
  },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  pressed: { opacity: 0.7 },
  text: { flex: 1, color: t.colors.text.primary, fontSize: 15, fontFamily: FONT_FAMILY.semibold },
  action: { minHeight: 40, minWidth: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.cta.brandBg },
  actionLabel: { color: t.colors.cta.brandFg, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  dismiss: { minHeight: 40, paddingHorizontal: 10, justifyContent: "center" },
  dismissLabel: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.medium },
});
