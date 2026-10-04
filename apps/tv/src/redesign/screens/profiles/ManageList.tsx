import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MANAGE_ACTIONS_GROUP, MANAGE_CREATE_KEY, MANAGE_INVITE_KEY, MANAGE_ROWS_GROUP, manageRowKey } from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text, white } from "../../theme/tokens";
import { ConfirmPill } from "../settings/ConfirmPill";
import type { ManageAction, ManageNotice, ManageRowView } from "./manageTypes";
import { ProfileAvatar } from "./ProfileAvatar";

/**
 * La liste de « Gérer les profils » : les deux gestes qui AJOUTENT (créer un
 * invité, inviter un membre — absents quand la famille ne le permet plus, et
 * la ligne dit pourquoi), puis chaque profil et chaque invitation en attente,
 * avec le geste qui RETIRE, à double appui (« Confirmer — … », une phrase dit
 * ce qui va se passer ; quitter le bouton désarme). Le propriétaire n'en a
 * pas : on ne se retire pas de sa propre famille depuis une TV.
 *
 * Clés : `manage:createGuest`, `manage:invite`, `manage:row:<i>` ; groupes
 * `manage:actions`, `manage:rows`.
 */
export const ManageList = memo(function ManageList({ rows, canCreateGuest, canInvite, blocked, armedId, notice, onCreateGuest, onInvite, onRowAction, onRowBlur }: {
  rows: ManageRowView[];
  canCreateGuest: boolean;
  canInvite: boolean;
  blocked: string | null;
  armedId: string | null;
  notice: ManageNotice | null;
  onCreateGuest?: () => void;
  onInvite?: () => void;
  onRowAction?: (id: string) => void;
  onRowBlur?: (id: string) => void;
}) {
  const { t } = useTranslation("familyTv");
  const armed = rows.find((row) => row.id === armedId)?.action ?? null;
  return (
    <View>
      {canCreateGuest || canInvite ? (
        <FocusGroup focusKey={MANAGE_ACTIONS_GROUP} style={styles.actions}>
          {canCreateGuest ? <PillButton label={t("manage.createGuest")} icon="plus" variant="primary" size="md" focusKey={MANAGE_CREATE_KEY} onPress={onCreateGuest} /> : null}
          {canInvite ? <PillButton label={t("manage.inviteMember")} icon="user" size="md" focusKey={MANAGE_INVITE_KEY} onPress={onInvite} /> : null}
        </FocusGroup>
      ) : null}
      {blocked ? <Text style={styles.blocked}>{blocked}</Text> : null}
      <FocusGroup focusKey={MANAGE_ROWS_GROUP} style={styles.rows}>
        {rows.map((row, index) => (
          <Row key={row.id} row={row} index={index} armed={row.id === armedId} onAction={onRowAction} onBlur={onRowBlur} />
        ))}
      </FocusGroup>
      <View style={styles.footer}>
        {armed ? (
          <View style={styles.hintRow}>
            <Icon name="alert" size={26} color={colors.accent} strokeWidth={2.4} />
            <Text style={[styles.hint, { color: colors.accentLight }]}>{armed.hint}</Text>
          </View>
        ) : notice ? (
          <Text style={[styles.hint, { color: notice.tone === "error" ? colors.warningFg : colors.successFg }]}>{notice.text}</Text>
        ) : null}
      </View>
    </View>
  );
});

const LABELS: Record<ManageAction, { label: string; armed: string; icon: "logout" | "close" }> = {
  remove: { label: "manage.remove", armed: "manage.removeConfirm", icon: "logout" },
  delete: { label: "manage.delete", armed: "manage.deleteConfirm", icon: "close" },
  cancel: { label: "manage.cancelInvite", armed: "manage.cancelConfirm", icon: "close" },
};

const Row = memo(function Row({ row, index, armed, onAction, onBlur }: {
  row: ManageRowView;
  index: number;
  armed: boolean;
  onAction?: (id: string) => void;
  onBlur?: (id: string) => void;
}) {
  const { t } = useTranslation("familyTv");
  const labels = row.action ? LABELS[row.action.kind] : null;
  return (
    <View style={styles.row}>
      <View style={row.invitation ? styles.pending : null}>
        <ProfileAvatar name={row.name} color={row.color} uri={row.avatarUri} size={AVATAR} />
      </View>
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
        <Text style={styles.detail} numberOfLines={1}>{row.detail}</Text>
      </View>
      {row.action && labels ? (
        <ConfirmPill
          label={t(labels.label)}
          icon={labels.icon}
          tone={row.action.kind === "cancel" ? "default" : "danger"}
          armed={armed}
          armedLabel={t(labels.armed)}
          focusKey={manageRowKey(index)}
          onPress={onAction ? () => onAction(row.id) : undefined}
          onFocusChange={(focused) => {
            if (!focused) onBlur?.(row.id);
          }}
        />
      ) : null}
    </View>
  );
});

const AVATAR = 76;

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 22, marginBottom: 18 },
  blocked: { ...text.caption, marginBottom: 12 },
  rows: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    minHeight: 92,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: white(0.08),
  },
  pending: { opacity: 0.55 },
  identity: { flex: 1, gap: 4 },
  name: { ...text.rowTitle },
  detail: { ...fonts.medium, fontSize: 24, lineHeight: 30, color: colors.textTertiary },
  footer: { minHeight: 64, justifyContent: "center", marginTop: 16 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hint: { ...fonts.semibold, fontSize: 26, lineHeight: 34 },
});
