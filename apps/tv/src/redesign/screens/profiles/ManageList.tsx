import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MANAGE_ACTIONS_GROUP, MANAGE_CREATE_KEY, MANAGE_INVITE_KEY, MANAGE_ROWS_GROUP, manageRowKey } from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { FocusSection } from "../../focus/FocusSection";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text } from "../../theme/tokens";
import { ConfirmPill } from "../settings/ConfirmPill";
import type { ManageNotice, ManageRowView } from "./manageTypes";
import { ProfileAvatar } from "./ProfileAvatar";
import { SheetRow, SheetRowStatic } from "./SheetRow";

/**
 * La liste de « Gérer les profils » : les deux gestes qui AJOUTENT (créer un
 * invité, inviter un membre — absents quand la famille ne le permet plus, et
 * la ligne dit pourquoi), puis chaque profil et chaque invitation en attente.
 * Un profil que la session gère est une ligne entière : OK ouvre sa FICHE
 * (décision du 16/10 — un parent y a la photo, le code, « peut demander »,
 * le contrôle parental ; le propriétaire en plus le rôle et les droits des
 * membres). Les autres (le propriétaire, la session elle-même) se lisent sans
 * prendre le focus. Une invitation garde son « Annuler », à double appui
 * (« Confirmer — … », une phrase dit ce qui va se passer ; quitter le bouton
 * désarme).
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
        <FocusSection focusKey={MANAGE_ACTIONS_GROUP} style={styles.actions}>
          {canCreateGuest ? <PillButton label={t("manage.createGuest")} icon="plus" size="md" focusKey={MANAGE_CREATE_KEY} onPress={onCreateGuest} /> : null}
          {canInvite ? <PillButton label={t("manage.inviteMember")} icon="user" size="md" focusKey={MANAGE_INVITE_KEY} onPress={onInvite} /> : null}
        </FocusSection>
      ) : null}
      {blocked ? <Text style={styles.blocked}>{blocked}</Text> : null}
      <FocusSection focusKey={MANAGE_ROWS_GROUP} list style={styles.rows}>
        {rows.map((row, index) => (
          <Row key={row.id} row={row} index={index} armed={row.id === armedId} onAction={onRowAction} onBlur={onRowBlur} />
        ))}
      </FocusSection>
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

const AVATAR = 64;

const Row = memo(function Row({ row, index, armed, onAction, onBlur }: {
  row: ManageRowView;
  index: number;
  armed: boolean;
  onAction?: (id: string) => void;
  onBlur?: (id: string) => void;
}) {
  const { t } = useTranslation("familyTv");
  const avatar = (
    <View style={row.invitation ? styles.pending : null}>
      <ProfileAvatar name={row.name} color={row.color} uri={row.avatarUri} size={AVATAR} />
    </View>
  );
  if (row.opens) {
    return (
      <SheetRow
        compact
        leading={avatar}
        title={row.name}
        description={row.detail}
        opens
        focusKey={manageRowKey(index)}
        onPress={onAction ? () => onAction(row.id) : undefined}
      />
    );
  }
  if (!row.action) return <SheetRowStatic compact leading={avatar} title={row.name} description={row.detail} />;
  return (
    <View style={styles.invitation}>
      <View style={styles.fill}>
        <SheetRowStatic compact leading={avatar} title={row.name} description={row.detail} />
      </View>
      <ConfirmPill
        label={t("manage.cancelInvite")}
        icon="close"
        armed={armed}
        armedLabel={t("manage.cancelConfirm")}
        focusKey={manageRowKey(index)}
        onPress={onAction ? () => onAction(row.id) : undefined}
        onFocusChange={(focused) => {
          if (!focused) onBlur?.(row.id);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 22, marginBottom: 18 },
  blocked: { ...text.caption, marginBottom: 12 },
  rows: { gap: 10 },
  pending: { opacity: 0.55 },
  invitation: { flexDirection: "row", alignItems: "center", gap: 22 },
  fill: { flex: 1 },
  footer: { minHeight: 56, justifyContent: "center", marginTop: 12 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hint: { ...fonts.semibold, fontSize: 26, lineHeight: 34 },
});
