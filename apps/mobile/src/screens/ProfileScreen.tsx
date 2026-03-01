import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Share } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth, useTentacleConfig, useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";

interface InviteKey {
  id: number;
  key: string;
  maxUses: number;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  usages: { username: string; usedAt: string }[];
}

export function ProfileScreen() {
  const { t } = useTranslation("profile");
  const router = useRouter();
  const { logout } = useAuth();
  const { storage } = useTentacleConfig();

  const user = (() => {
    try {
      const raw = storage.getItem("tentacle_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const isAdmin = user?.Policy?.IsAdministrator === true;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => router.replace("/(auth)/login"),
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0a0a0f" }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56 }}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 20 }}>{t("profile:title")}</Text>

        {/* User info */}
        <View style={{
          backgroundColor: "#12121a", borderRadius: 12, padding: 20,
          borderWidth: 1, borderColor: "#1e1e2e", marginBottom: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{user?.Name ?? t("profile:defaultUsername")}</Text>
          {isAdmin && (
            <View style={{ marginTop: 6, backgroundColor: "rgba(139,92,246,0.15)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" }}>
              <Text style={{ color: "#8b5cf6", fontSize: 12, fontWeight: "600" }}>{t("profile:adminBadge")}</Text>
            </View>
          )}
        </View>

        {/* Logout */}
        <Pressable onPress={handleLogout} style={{
          backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12, paddingVertical: 14, alignItems: "center",
          borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", marginBottom: 24,
        }}>
          <Text style={{ color: "#ef4444", fontSize: 15, fontWeight: "600" }}>{t("profile:logout")}</Text>
        </Pressable>

        {/* Paired devices */}
        <PairedDevicesSection />

        {/* Admin section */}
        {isAdmin && <AdminSection />}
      </View>
    </ScrollView>
  );
}

function AdminSection() {
  const { t } = useTranslation("profile");
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const [invites, setInvites] = useState<InviteKey[]>([]);
  const [maxUses, setMaxUses] = useState("1");
  const [expiresHours, setExpiresHours] = useState("72");
  const [creating, setCreating] = useState(false);

  const fetchInvites = useCallback(async () => {
    if (!serverUrl) return;
    const res = await fetch(`${serverUrl}/api/invites`);
    if (res.ok) setInvites(await res.json());
  }, [serverUrl]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const createInvite = async () => {
    if (!serverUrl) return;
    setCreating(true);
    const res = await fetch(`${serverUrl}/api/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxUses: Number(maxUses), expiresInHours: Number(expiresHours) }),
    });
    if (res.ok) await fetchInvites();
    setCreating(false);
  };

  const shareInvite = (key: string) => {
    const url = `${serverUrl}/register?invite=${key}`;
    Share.share({ message: t("profile:shareInviteMessage", { url }) });
  };

  return (
    <View>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>{t("profile:administration")}</Text>

      {/* Create invite */}
      <View style={{ backgroundColor: "#12121a", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#1e1e2e", marginBottom: 16 }}>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 12 }}>{t("profile:generateInvite")}</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 }}>{t("profile:maxUses")}</Text>
            <TextInput value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad"
              style={adminInputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 }}>{t("profile:expiresHours")}</Text>
            <TextInput value={expiresHours} onChangeText={setExpiresHours} keyboardType="number-pad"
              style={adminInputStyle} />
          </View>
        </View>
        <Pressable onPress={createInvite} disabled={creating} style={{
          marginTop: 12, backgroundColor: "#8b5cf6", borderRadius: 8, paddingVertical: 10, alignItems: "center",
          opacity: creating ? 0.6 : 1,
        }}>
          {creating ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("profile:generate")}</Text>
          )}
        </Pressable>
      </View>

      {/* Invite list */}
      {invites.map((inv) => {
        const expired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
        const full = inv.currentUses >= inv.maxUses;
        const active = !expired && !full;
        return (
          <View key={inv.id} style={{
            backgroundColor: "#12121a", borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: "#1e1e2e", marginBottom: 8, opacity: active ? 1 : 0.5,
          }}>
            <Text style={{ color: "#8b5cf6", fontSize: 13, fontFamily: "monospace" }}>{inv.key}</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>
              {t("profile:usedCount", { current: inv.currentUses, max: inv.maxUses })} — {t("profile:createdOn", { date: new Date(inv.createdAt).toLocaleDateString() })}
              {expired ? ` — ${t("profile:expired")}` : ""}
            </Text>
            {inv.usages.length > 0 && (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {inv.usages.map((u) => (
                  <View key={u.username} style={{ backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{u.username}</Text>
                  </View>
                ))}
              </View>
            )}
            {active && (
              <Pressable onPress={() => shareInvite(inv.key)} style={{
                marginTop: 8, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 6, paddingVertical: 6, alignItems: "center",
              }}>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{t("profile:shareLink")}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

function PairedDevicesSection() {
  const { t } = useTranslation("pairing");
  const { data: devices } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();

  if (!devices || devices.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
        {t("pairing:pairedDevices")}
      </Text>
      {devices.map((device) => (
        <View key={device.id} style={{
          backgroundColor: "#12121a", borderRadius: 12, padding: 14,
          borderWidth: 1, borderColor: "#1e1e2e", marginBottom: 8,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{device.name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>
              {t("pairing:lastActive", { date: new Date(device.lastSeen).toLocaleDateString() })}
            </Text>
          </View>
          <Pressable
            onPress={() => revokeMut.mutate(device.id)}
            disabled={revokeMut.isPending}
            style={{
              backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8,
              paddingVertical: 6, paddingHorizontal: 12,
              opacity: revokeMut.isPending ? 0.4 : 1,
            }}
          >
            <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>
              {t("pairing:revoke")}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const adminInputStyle = {
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1, borderColor: "#1e1e2e",
  borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  color: "#fff", fontSize: 14,
};
