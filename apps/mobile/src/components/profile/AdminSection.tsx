import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Share } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { colors, spacing, typography } from "../../theme";
import { GlassCard } from "../ui";

interface InviteKey {
  id: number;
  key: string;
  maxUses: number;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  usages: { username: string; usedAt: string }[];
}

export function AdminSection() {
  const { t } = useTranslation("profile");
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const [invites, setInvites] = useState<InviteKey[]>([]);
  const [maxUses, setMaxUses] = useState("1");
  const [expiresHours, setExpiresHours] = useState("72");
  const [creating, setCreating] = useState(false);

  const token = storage.getItem("tentacle_token");

  const fetchInvites = useCallback(async () => {
    if (!serverUrl || !token) return;
    const res = await fetch(`${serverUrl}/api/invites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setInvites(await res.json());
  }, [serverUrl, token]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const createInvite = async () => {
    if (!serverUrl || !token) return;
    setCreating(true);
    const res = await fetch(`${serverUrl}/api/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ maxUses: Number(maxUses), expiresInHours: Number(expiresHours) }),
    });
    if (res.ok) await fetchInvites();
    setCreating(false);
  };

  const shareInvite = (key: string) => {
    const url = `${serverUrl}/register?invite=${key}`;
    Share.share({ message: t("shareInviteMessage", { url }) });
  };

  return (
    <View>
      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
        {t("administration")}
      </Text>

      <GlassCard style={{ marginBottom: spacing.lg }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.md }}>
          {t("generateInvite")}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.small, color: colors.textMuted, marginBottom: spacing.xs }}>
              {t("maxUses")}
            </Text>
            <TextInput value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad" style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.small, color: colors.textMuted, marginBottom: spacing.xs }}>
              {t("expiresHours")}
            </Text>
            <TextInput value={expiresHours} onChangeText={setExpiresHours} keyboardType="number-pad" style={inputStyle} />
          </View>
        </View>
        <Pressable onPress={createInvite} disabled={creating} style={{
          marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: spacing.buttonRadius,
          paddingVertical: 10, alignItems: "center", opacity: creating ? 0.6 : 1,
        }}>
          {creating ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={{ ...typography.bodyBold, color: "#fff" }}>{t("generate")}</Text>
          )}
        </Pressable>
      </GlassCard>

      {invites.map((inv) => {
        const expired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
        const full = inv.currentUses >= inv.maxUses;
        const active = !expired && !full;
        return (
          <GlassCard key={inv.id} style={{ marginBottom: spacing.sm, opacity: active ? 1 : 0.5 }}>
            <Text style={{ color: colors.accent, ...typography.caption, fontFamily: "monospace" }}>{inv.key}</Text>
            <Text style={{ color: colors.textMuted, ...typography.small, marginTop: spacing.xs }}>
              {t("usedCount", { current: inv.currentUses, max: inv.maxUses })} — {t("createdOn", { date: new Date(inv.createdAt).toLocaleDateString() })}
              {expired ? ` — ${t("expired")}` : ""}
            </Text>
            {inv.usages.length > 0 && (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {inv.usages.map((u) => (
                  <View key={u.username} style={{ backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: colors.textSecondary, ...typography.small }}>{u.username}</Text>
                  </View>
                ))}
              </View>
            )}
            {active && (
              <Pressable onPress={() => shareInvite(inv.key)} style={{
                marginTop: spacing.sm, backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: spacing.badgeRadius, paddingVertical: 6, alignItems: "center",
              }}>
                <Text style={{ color: colors.textSecondary, ...typography.caption }}>{t("shareLink")}</Text>
              </Pressable>
            )}
          </GlassCard>
        );
      })}
    </View>
  );
}

const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: spacing.buttonRadius,
  paddingHorizontal: spacing.md,
  paddingVertical: 10,
  color: colors.textPrimary,
  fontSize: 14,
};
