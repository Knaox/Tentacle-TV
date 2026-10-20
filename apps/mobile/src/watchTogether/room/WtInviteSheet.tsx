import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, Search } from "lucide-react-native";
import { useInvitableUsers } from "@tentacle-tv/api-client";
import type { WtInvitableUserDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { KeyboardAvoidingArea } from "@/components/ui/KeyboardAvoidingArea";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { inviteCandidates, toggleSelection, type InviteCandidate } from "@tentacle-tv/shared";

/**
 * Inviter une ou plusieurs personnes : recherche, liste cochable (en ligne
 * d'abord), pied fixe « Inviter (N) ». Rend la main une fois les invitations
 * parties — elles attendent leur réponse dans la feuille du groupe.
 */
export function WtInviteSheet({ visible, onClose, room, pendingUserIds, onSend }: {
  visible: boolean;
  onClose: () => void;
  room: WtRoomStateDto;
  pendingUserIds: ReadonlySet<string>;
  /** Envoie ; rend le nombre d'invitations parties. */
  onSend: (users: WtInvitableUserDto[]) => Promise<number>;
}) {
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const { data: users, isLoading } = useInvitableUsers(visible);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<ReadonlyMap<string, WtInvitableUserDto>>(new Map());
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const candidates = useMemo(
    () => inviteCandidates(users ?? [], room, pendingUserIds, query),
    [users, room, pendingUserIds, query],
  );
  const toggle = useCallback((c: InviteCandidate) => setSelection((cur) => toggleSelection(cur, c)), []);

  const close = (): void => { setSelection(new Map()); setQuery(""); setFailed(false); onClose(); };
  const send = (): void => {
    setSending(true);
    setFailed(false);
    onSend([...selection.values()]).then(
      () => { setSending(false); close(); },
      () => { setSending(false); setFailed(true); },
    );
  };

  return (
    <BottomSheet visible={visible} onClose={close} snapPoints={[0.8, 0.94]}>
      <KeyboardAvoidingArea>
      <View style={s.wrap} testID="wt-invite-sheet">
        <Text style={s.title} accessibilityRole="header">{t("inviteTitle")}</Text>
        <Text style={s.hint}>{t("inviteHint")}</Text>
        <View style={s.search}>
          <Search size={18} color={theme.colors.text.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchUsers")}
            placeholderTextColor={theme.colors.text.tertiary}
            style={s.input}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t("searchUsers")}
            testID="wt-invite-search"
          />
        </View>
        {isLoading ? (
          <ActivityIndicator style={s.loading} color={theme.colors.brand.light} />
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(c) => c.user.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <CandidateRow candidate={item} selected={selection.has(item.user.id)} onToggle={toggle} />
            )}
            ListEmptyComponent={<Text style={s.empty}>{t("noUsersFound")}</Text>}
          />
        )}
        <View style={s.footer}>
          {failed && <Text style={s.error} accessibilityLiveRegion="polite">{t("errorGeneric")}</Text>}
          <Button
            title={selection.size > 0 ? t("sendInvitesCount", { count: selection.size }) : t("sendInvites")}
            onPress={send}
            loading={sending}
            disabled={selection.size === 0 || sending}
            fullWidth
          />
        </View>
      </View>
      </KeyboardAvoidingArea>
    </BottomSheet>
  );
}

const CandidateRow = memo(function CandidateRow({ candidate, selected, onToggle }: {
  candidate: InviteCandidate;
  selected: boolean;
  onToggle: (c: InviteCandidate) => void;
}) {
  const { t } = useTranslation("watchTogether");
  const s = useThemedStyles(makeStyles);
  const { user, invited } = candidate;
  const status = invited ? t("alreadyInvited") : user.isOnline ? t("online") : t("offline");
  return (
    <Pressable
      onPress={() => onToggle(candidate)}
      disabled={invited}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: invited }}
      accessibilityLabel={`${user.name}, ${status}`}
      style={({ pressed }) => [s.row, selected && s.rowSelected, pressed && s.rowPressed]}
      testID={`wt-invite-user-${user.id}`}
    >
      <View style={invited ? s.dim : undefined}>
        <UserAvatar userId={user.id} name={user.name} hasAvatar={user.hasAvatar} size={40} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.name, invited && s.nameDim]} numberOfLines={1}>{user.name}</Text>
        <Text style={s.status} numberOfLines={1}>{status}</Text>
      </View>
      {!invited && (
        <View style={[s.check, selected && s.checkOn]}>
          {selected && <Check size={14} color="#ffffff" strokeWidth={3} />}
        </View>
      )}
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  title: { color: t.colors.text.primary, fontSize: 22, fontFamily: FONT_FAMILY.extrabold },
  hint: { marginTop: 4, color: t.colors.text.secondary, fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
  search: {
    marginTop: 16, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44,
    paddingHorizontal: 12, borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.subtle,
  },
  input: { flex: 1, color: t.colors.text.primary, fontSize: 16, fontFamily: FONT_FAMILY.regular, paddingVertical: 10 },
  loading: { marginTop: 32 },
  empty: { marginTop: 24, textAlign: "center", color: t.colors.text.tertiary, fontSize: 14, fontFamily: FONT_FAMILY.regular },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 8, borderRadius: RADIUS.lg },
  rowSelected: { backgroundColor: t.colors.brand.ghost },
  rowPressed: { opacity: 0.8 },
  dim: { opacity: 0.5 },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: t.colors.text.primary, fontSize: 16, fontFamily: FONT_FAMILY.semibold },
  nameDim: { color: t.colors.text.tertiary },
  status: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular },
  check: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: t.colors.border.strong,
    alignItems: "center", justifyContent: "center",
  },
  checkOn: { backgroundColor: t.colors.brand.violet, borderColor: t.colors.brand.violet },
  footer: { paddingVertical: 12, gap: 8 },
  error: { color: t.colors.status.error, fontSize: 13, textAlign: "center", fontFamily: FONT_FAMILY.regular },
});
