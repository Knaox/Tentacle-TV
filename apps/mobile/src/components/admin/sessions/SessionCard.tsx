import { memo } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  buttonStatus, formatClock, joinParts, livePositionTicks, sessionApp, sessionDeviceName,
  type AdminPlaystateCommand, type AdminSessionDto, type Feedback,
} from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ActionPill } from "./ActionPill";
import { AppLabel } from "./AppLabel";
import { CommandStatus } from "./CommandStatus";
import { PlaybackDetails } from "./PlaybackDetails";
import { UserAvatar } from "./UserAvatar";

export interface SessionCardActions {
  onPlaystate: (session: AdminSessionDto, command: AdminPlaystateCommand) => void;
  onMessage: (session: AdminSessionDto) => void;
}

/**
 * Une lecture en cours : qui, sur quoi, où en est-on, comment le média
 * arrive — et la main pour intervenir. La barre avance entre deux instantanés
 * (position extrapolée à la seconde, en `scaleX` : rien ne se repeint).
 *
 * Arrêter se confirme (la feuille native, bouton destructif) : c'est la
 * soirée de quelqu'un. Une lecture arrêtée quitte la liste en s'effaçant.
 */
export const SessionCard = memo(function SessionCard({ session, now, clockOffsetMs, actions, feedback }: {
  session: AdminSessionDto;
  now: number;
  clockOffsetMs: number;
  actions: SessionCardActions;
  feedback: Feedback | undefined;
}) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const item = session.nowPlaying;
  if (!item) return null;

  const position = livePositionTicks(session.positionTicks, session.positionAt, session.isPaused, now, clockOffsetMs, item.runTimeTicks);
  const fraction = item.runTimeTicks ? Math.min(1, position / item.runTimeTicks) : 0;
  const title = item.seriesName ?? item.name;
  const subtitle = item.seriesName
    ? joinParts([
        item.seasonNumber !== undefined && item.episodeNumber !== undefined
          ? t("episodeCode", { season: item.seasonNumber, episode: item.episodeNumber })
          : null,
        item.name,
      ])
    : item.productionYear !== undefined ? String(item.productionYear) : "";
  const poster = client.getImageUrl(item.imageItemId, "Primary", { width: 180, quality: 80, tag: item.imageTag });
  const device = sessionDeviceName(sessionApp(session));

  const confirmStop = () => Alert.alert(
    t("stopConfirm"),
    t("stopConfirmBody", { name: session.userName, device }),
    [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirmStop"), style: "destructive", onPress: () => actions.onPlaystate(session, "Stop") },
    ],
  );

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      style={st.card}
      accessibilityLabel={`${session.userName} — ${title}`}
    >
      <View style={st.top}>
        <View style={st.poster}>
          <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
        </View>
        <View style={st.info}>
          <Text style={st.title} numberOfLines={1}>{title}</Text>
          {subtitle !== "" && <Text style={st.subtitle} numberOfLines={1}>{subtitle}</Text>}
          <View style={st.who}>
            <UserAvatar userId={session.userId} name={session.userName} hasAvatar={session.userImageTag !== null} size={22} />
            <Text style={st.user} numberOfLines={1}>{session.userName}</Text>
            {session.viaTentacle && (
              <View style={st.tentacle} accessible accessibilityLabel={t("viaTentacle")} accessibilityHint={t("viaTentacleHint")}>
                <Feather name="radio" size={10} color={theme.colors.brand.light} />
                <Text style={st.tentacleTxt}>{t("viaTentacle")}</Text>
              </View>
            )}
          </View>
          <AppLabel session={session} style={st.app} />
        </View>
      </View>

      <View style={st.progress}>
        <View style={st.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
          <View style={[st.fill, { transform: [{ scaleX: fraction }] }]} />
        </View>
        <View style={st.statusRow}>
          <CommandStatus isPaused={session.isPaused} feedback={feedback} />
          <Text style={st.clock}>
            {formatClock(position)}
            {item.runTimeTicks ? ` / ${formatClock(item.runTimeTicks)}` : ""}
          </Text>
        </View>
      </View>

      <PlaybackDetails session={session} />

      {session.supportsRemoteControl ? (
        <View style={st.actions}>
          <ActionPill
            icon={session.isPaused ? "play" : "pause"}
            label={session.isPaused ? t("resume") : t("pause")}
            errorLabel={t("failedShort")}
            status={buttonStatus(feedback, ["Pause", "Unpause"])}
            onPress={() => actions.onPlaystate(session, session.isPaused ? "Unpause" : "Pause")}
          />
          <ActionPill
            tone="brand"
            icon="message-square"
            label={t("message")}
            doneLabel={t("sentShort")}
            errorLabel={t("failedShort")}
            status={buttonStatus(feedback, ["message"])}
            onPress={() => actions.onMessage(session)}
          />
          <View style={st.spacer} />
          <ActionPill
            tone="danger"
            icon="square"
            label={buttonStatus(feedback, ["Stop"]) === "busy" ? t("stopping") : t("stop")}
            errorLabel={t("failedShort")}
            status={buttonStatus(feedback, ["Stop"])}
            onPress={confirmStop}
          />
        </View>
      ) : (
        <View style={st.noRemote}>
          <Feather name="lock" size={12} color={theme.colors.text.tertiary} />
          <Text style={st.noRemoteTxt}>{t("noRemote")}</Text>
        </View>
      )}
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
    top: { flexDirection: "row" as const, gap: spacing.md },
    poster: { width: 64, height: 96, borderRadius: RADIUS.md, overflow: "hidden" as const, backgroundColor: t.colors.surface.s3 },
    info: { flex: 1, minWidth: 0, gap: 3 },
    title: { fontSize: 16, lineHeight: 21, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    subtitle: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    who: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: 6 },
    user: { flexShrink: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    tentacle: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 3,
      height: 20,
      paddingHorizontal: 7,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.brand.soft,
    },
    tentacleTxt: { fontSize: 10.5, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, letterSpacing: 0.2 },
    app: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    progress: { gap: 6 },
    track: { height: 5, borderRadius: 3, overflow: "hidden" as const, backgroundColor: t.colors.fill.soft },
    fill: { height: "100%" as const, borderRadius: 3, backgroundColor: t.colors.brand.violet, transformOrigin: "left" },
    statusRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: spacing.sm },
    clock: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    actions: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border.subtle,
    },
    spacer: { flex: 1 },
    noRemote: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border.subtle,
    },
    noRemoteTxt: { flex: 1, fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
