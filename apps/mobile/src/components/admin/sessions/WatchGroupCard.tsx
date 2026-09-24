import { memo } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  buttonStatus, deliveryOf, formatClock, joinParts, livePositionTicks,
  type AdminSessionDto, type AdminWatchGroupDto, type Feedback,
} from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ActionPill } from "./ActionPill";
import { AppLabel } from "./AppLabel";
import { CommandStatus } from "./CommandStatus";
import { DeliveryChip } from "./DeliveryChip";
import { UserAvatar } from "./UserAvatar";

/**
 * Une salle Watch Together : ce qu'elle regarde, où elle en est, chacun de
 * ses membres — statut, écart au rythme de la salle, et la façon dont le
 * média lui arrive (la salle lit UN fichier, c'est l'appareil de chacun qui
 * fait la différence). Un message ou un arrêt part à TOUS.
 */
export const WatchGroupCard = memo(function WatchGroupCard({
  group, sessionsById, now, clockOffsetMs, feedback, onMessage, onStop,
}: {
  group: AdminWatchGroupDto;
  sessionsById: ReadonlyMap<string, AdminSessionDto>;
  now: number;
  clockOffsetMs: number;
  feedback: Feedback | undefined;
  onMessage: (group: AdminWatchGroupDto) => void;
  onStop: (group: AdminWatchGroupDto) => void;
}) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  // Ce que regarde la salle, lu sur la session d'un membre qui le lit.
  const item = group.members
    .map((m) => (m.sessionId ? sessionsById.get(m.sessionId)?.nowPlaying : undefined))
    .find((n) => n != null);
  const position = livePositionTicks(group.positionTicks, group.positionAt, group.isPaused, now, clockOffsetMs, item?.runTimeTicks);
  const title = item ? item.seriesName ?? item.name : "—";

  const confirmStop = () => Alert.alert(
    t("stopAllConfirm"),
    t("stopAllConfirmBody", { count: group.members.length }),
    [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirmStop"), style: "destructive", onPress: () => onStop(group) },
    ],
  );

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={st.card} accessibilityLabel={`${t("sectionGroups")} — ${title}`}>
      <View style={st.head}>
        {item && (
          <View style={st.poster}>
            <Image
              source={{ uri: client.getImageUrl(item.imageItemId, "Primary", { width: 120, quality: 80, tag: item.imageTag }) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
            />
          </View>
        )}
        <View style={st.headText}>
          <Text style={st.title} numberOfLines={1}>{title}</Text>
          {item?.seriesName && <Text style={st.subtitle} numberOfLines={1}>{item.name}</Text>}
          <View style={st.meta}>
            <View style={st.metaItem}>
              <Feather name="users" size={12} color={theme.colors.text.tertiary} />
              <Text style={st.metaTxt}>{t("groupOf", { count: group.members.length })}</Text>
            </View>
            <CommandStatus isPaused={group.isPaused} feedback={feedback} />
            <Text style={st.metaTxt}>{formatClock(position)}{item?.runTimeTicks ? ` / ${formatClock(item.runTimeTicks)}` : ""}</Text>
          </View>
        </View>
      </View>

      <View style={st.members}>
        {group.members.map((member) => {
          const session = member.sessionId ? sessionsById.get(member.sessionId) : undefined;
          const status = !member.inPlayback
            ? t("notInPlayback")
            : member.buffering
              ? t("buffering")
              : member.driftMs !== null && Math.abs(member.driftMs) >= 250
                ? t("drift", { ms: Math.round(member.driftMs) })
                : t("inSync");
          return (
            <View key={member.userId} style={st.member}>
              <UserAvatar userId={member.userId} name={member.userName} hasAvatar={member.hasAvatar} size={30} />
              <View style={st.memberText}>
                <View style={st.memberName}>
                  <Text style={st.name} numberOfLines={1}>{member.userName}</Text>
                  {member.isHost && <Feather name="award" size={12} color={theme.colors.brand.light} accessibilityLabel={t("host")} />}
                </View>
                <Text style={st.status} numberOfLines={1}>
                  {joinParts([status, !session && member.inPlayback ? t("noSession") : null])}
                </Text>
                {session && <AppLabel session={session} style={st.status} />}
              </View>
              {session?.nowPlaying && <DeliveryChip kind={deliveryOf(session)} size="sm" />}
            </View>
          );
        })}
      </View>

      <View style={st.actions}>
        <ActionPill
          tone="brand"
          icon="message-square"
          label={t("messageGroup")}
          doneLabel={t("sentShort")}
          errorLabel={t("failedShort")}
          status={buttonStatus(feedback, ["message"])}
          onPress={() => onMessage(group)}
        />
        <View style={st.spacer} />
        <ActionPill
          tone="danger"
          icon="square"
          label={buttonStatus(feedback, ["Stop"]) === "busy" ? t("stopping") : t("stopAll")}
          errorLabel={t("failedShort")}
          status={buttonStatus(feedback, ["Stop"])}
          onPress={confirmStop}
        />
      </View>
    </Animated.View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    head: { flexDirection: "row" as const, gap: spacing.md },
    poster: { width: 52, height: 78, borderRadius: RADIUS.sm, overflow: "hidden" as const, backgroundColor: t.colors.surface.s3 },
    headText: { flex: 1, minWidth: 0, gap: 3 },
    title: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    subtitle: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    meta: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, columnGap: 12, rowGap: 4, marginTop: 4 },
    metaItem: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
    metaTxt: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    members: { gap: spacing.sm },
    member: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
    memberText: { flex: 1, minWidth: 0 },
    memberName: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
    name: { flexShrink: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    status: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    actions: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border.subtle,
    },
    spacer: { flex: 1 },
  });
