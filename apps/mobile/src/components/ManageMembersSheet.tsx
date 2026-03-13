import { useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useShareableUsers,
  useSharedWatchlistMembers,
  useAddSharedWatchlistMember,
  useUpdateMemberRole,
  useRemoveMember,
  type SharedWatchlistMember,
  type ShareRole,
} from "@tentacle-tv/api-client";
import { BottomSheet } from "./ui";
import { colors, spacing, typography } from "@/theme";

interface Props {
  visible: boolean;
  watchlistId: string;
  watchlistName: string;
  onClose: () => void;
}

export function ManageMembersSheet({ visible, watchlistId, watchlistName, onClose }: Props) {
  const { t } = useTranslation("common");
  const { data: users, isLoading: usersLoading } = useShareableUsers();
  const { data: members } = useSharedWatchlistMembers(visible ? watchlistId : null);
  const addMember = useAddSharedWatchlistMember(watchlistId);
  const updateRole = useUpdateMemberRole(watchlistId);
  const removeMember = useRemoveMember(watchlistId);

  const memberIds = new Set(members?.map((m) => m.userId) ?? []);

  const handleInvite = useCallback((userId: string, username: string) => {
    addMember.mutate({ userId, username, role: "reader" });
  }, [addMember]);

  const handleRoleChange = useCallback((memberId: string, role: ShareRole) => {
    updateRole.mutate({ memberId, role });
  }, [updateRole]);

  const handleRemove = useCallback((memberId: string) => {
    removeMember.mutate(memberId);
  }, [removeMember]);

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.55, 0.9]}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPadding }}>
        <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: 2 }}>
          {t("manageMembers")}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.md }}>
          {watchlistName}
        </Text>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Membres actuels */}
          {members && members.length > 0 && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ ...typography.badge, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm }}>
                {t("memberCount", { count: members.length })}
              </Text>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onRoleChange={handleRoleChange}
                  onRemove={handleRemove}
                  t={t}
                />
              ))}
            </View>
          )}

          {/* Inviter */}
          <Text style={{ ...typography.badge, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm }}>
            {t("invite")}
          </Text>
          {usersLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: spacing.md }} />
          ) : (
            users?.filter((u) => !memberIds.has(u.Id)).map((user) => (
              <View
                key={user.Id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: spacing.cardRadius,
                  padding: spacing.md,
                  marginBottom: spacing.xs,
                }}
              >
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: colors.accent,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                    {user.Name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ ...typography.body, color: colors.textSecondary, flex: 1, marginLeft: spacing.md }}>
                  {user.Name}
                </Text>
                <Pressable
                  onPress={() => handleInvite(user.Id, user.Name)}
                  disabled={addMember.isPending}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: spacing.buttonRadius,
                    backgroundColor: `${colors.accent}15`,
                  }}
                >
                  <Feather name="plus" size={18} color={colors.accent} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

/* ── Ligne membre ─────────────────────────────────── */

function MemberRow({ member, onRoleChange, onRemove, t }: {
  member: SharedWatchlistMember;
  onRoleChange: (memberId: string, role: ShareRole) => void;
  onRemove: (memberId: string) => void;
  t: (key: string) => string;
}) {
  const isContributor = member.role === "contributor";

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderRadius: spacing.cardRadius,
      padding: spacing.md,
      marginBottom: spacing.xs,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.accent,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
          {member.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={{ ...typography.body, color: colors.textSecondary, flex: 1, marginLeft: spacing.md }}>
        {member.username}
      </Text>
      <View style={{ flexDirection: "row", gap: 4, marginRight: spacing.sm }}>
        <RolePill active={!isContributor} label={t("reader")} onPress={() => onRoleChange(member.id, "reader")} />
        <RolePill active={isContributor} label={t("contributor")} onPress={() => onRoleChange(member.id, "contributor")} accent />
      </View>
      <Pressable onPress={() => onRemove(member.id)} hitSlop={8} style={{ padding: 4 }}>
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function RolePill({ active, label, onPress, accent }: {
  active: boolean; label: string; onPress: () => void; accent?: boolean;
}) {
  const activeBg = accent ? `${colors.accent}25` : `${colors.textSecondary}20`;
  const activeColor = accent ? colors.accent : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: active ? activeBg : `${colors.textMuted}10`,
      }}
    >
      <Text style={{
        ...typography.badge,
        color: active ? activeColor : colors.textDim,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
