import { memo, useMemo, useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Film, Heart, LogOut, UserPlus } from "lucide-react-native";
import type { WtRoomStateDto } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { roomMemberRows } from "../model/roomModel";
import { WtMemberRow, WtPendingInviteRow } from "./WtMemberRow";

export interface WtPendingInviteView { userId: string; username: string; hasAvatar: boolean }

export interface WtRoomSheetViewProps {
  visible: boolean;
  onClose: () => void;
  room: WtRoomStateDto;
  selfId: string | null;
  pendingInvites: readonly WtPendingInviteView[];
  /** Le titre au programme (nom et vignette), s'il y en a un et qu'il est connu. */
  program: { title: string; imageUrl: string | null } | null;
  /** Le compte peut inviter (`mayCreate` de l'accès Watch Together). */
  mayInvite: boolean;
  /** L'affinité est proposable (serveur et extension la portent). */
  affinityAvailable: boolean;
  /** Rejoindre le lecteur du titre au programme (absent : on y est déjà). */
  onStart?: () => void;
  onInvite: () => void;
  onAffinity: () => void;
  onLeave: () => Promise<void>;
  onKick: (userId: string) => Promise<void>;
}

/**
 * La feuille du groupe — le « salon » du mobile et de l'iPad (form-sheet
 * centrée de 520 pt sur grand écran, `BottomSheet`). De haut en bas : le
 * groupe, ce qu'il regarde, qui est là (états dits en mots), puis UNE action
 * principale (« Inviter des membres »), l'affinité, et, séparée, rouge,
 * « Quitter le groupe » (confirmée). Vue pure : le contexte la nourrit.
 */
export const WtRoomSheetView = memo(function WtRoomSheetView(props: WtRoomSheetViewProps) {
  const { visible, onClose, room, selfId, pendingInvites, program, mayInvite, affinityAvailable } = props;
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const rows = useMemo(() => roomMemberRows(room, selfId), [room, selfId]);
  const [leaving, setLeaving] = useState(false);

  const confirmLeave = (): void => {
    Alert.alert(t("leaveGroup"), undefined, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("leaveGroup"), style: "destructive",
        onPress: () => {
          setLeaving(true);
          props.onLeave().then(onClose, () => setLeaving(false));
        },
      },
    ]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.62, 0.94]}>
      <ScrollView contentContainerStyle={s.content} testID="wt-room-sheet">
        <Text style={s.title} accessibilityRole="header">{t("yourRoom")}</Text>
        <Text style={s.subtitle}>{t("roomHint")}</Text>

        <Text style={s.section}>{t("onTheProgram")}</Text>
        {program ? (
          <View style={s.program}>
            {program.imageUrl
              ? <Image source={{ uri: program.imageUrl }} style={s.programImage} contentFit="cover" accessible={false} />
              : <View style={[s.programImage, s.programPlaceholder]}><Film size={22} color={theme.colors.text.tertiary} /></View>}
            <Text style={s.programTitle} numberOfLines={2}>{program.title}</Text>
            {props.onStart && (
              <Button title={t("rejoin")} onPress={props.onStart} variant="secondary" accessibilityLabel={`${t("rejoin")} — ${program.title}`} />
            )}
          </View>
        ) : (
          <Text style={s.empty}>{t("roomNoItem")}</Text>
        )}

        <Text style={s.section}>{t("inTheRoom", { count: room.members.length })}</Text>
        {rows.map((row) => <WtMemberRow key={row.member.userId} row={row} onKick={props.onKick} />)}
        {pendingInvites.map((p) => <WtPendingInviteRow key={p.userId} {...p} />)}
        {rows.length <= 1 && pendingInvites.length === 0 && <Text style={s.empty}>{t("roomAlone")}</Text>}

        <View style={s.actions}>
          {mayInvite && (
            <ActionRow icon={<UserPlus size={20} color={theme.colors.cta.brandFg} />} label={t("inviteMembers")}
              onPress={props.onInvite} primary testID="wt-invite" />
          )}
          {affinityAvailable && (
            <ActionRow icon={<Heart size={20} color={theme.colors.text.primary} />} label={t("affinityFind")}
              onPress={props.onAffinity} testID="wt-affinity" />
          )}
        </View>

        <View style={s.separator} />
        <ActionRow icon={<LogOut size={20} color={theme.colors.status.error} />} label={t("leaveGroup")}
          onPress={confirmLeave} danger disabled={leaving} testID="wt-leave" />
      </ScrollView>
    </BottomSheet>
  );
});

function ActionRow({ icon, label, onPress, primary, danger, disabled, testID }: {
  icon: ReactNode; label: string; onPress: () => void;
  primary?: boolean; danger?: boolean; disabled?: boolean; testID?: string;
}) {
  const s = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [s.action, primary && s.actionPrimary, pressed && s.actionPressed, disabled && s.actionDisabled]}
    >
      {icon}
      <Text style={[s.actionLabel, primary && s.actionLabelPrimary, danger && s.actionLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { color: t.colors.text.primary, fontSize: 22, fontFamily: FONT_FAMILY.extrabold },
  subtitle: { marginTop: 4, color: t.colors.text.secondary, fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
  section: {
    marginTop: 24, marginBottom: 8, color: t.colors.text.tertiary, fontSize: 12,
    fontFamily: FONT_FAMILY.semibold, textTransform: "uppercase", letterSpacing: 0.6,
  },
  program: { flexDirection: "row", alignItems: "center", gap: 12 },
  programImage: { width: 96, height: 54, borderRadius: RADIUS.md, backgroundColor: t.colors.fill.subtle },
  programPlaceholder: { alignItems: "center", justifyContent: "center" },
  programTitle: { flex: 1, color: t.colors.text.primary, fontSize: 15, fontFamily: FONT_FAMILY.semibold },
  empty: { color: t.colors.text.tertiary, fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
  actions: { marginTop: 24, gap: 8 },
  action: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16,
    borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.subtle,
  },
  actionPrimary: { backgroundColor: t.colors.cta.brandBg },
  actionPressed: { opacity: 0.75 },
  actionDisabled: { opacity: 0.45 },
  actionLabel: { flex: 1, color: t.colors.text.primary, fontSize: 16, fontFamily: FONT_FAMILY.semibold },
  actionLabelPrimary: { color: t.colors.cta.brandFg },
  actionLabelDanger: { color: t.colors.status.error },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border.subtle, marginVertical: 16 },
});
