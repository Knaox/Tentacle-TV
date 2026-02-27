import { View, ScrollView, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle/api-client";
import { APP_VERSION } from "@tentacle/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { TentacleIcon } from "../components/icons/TVIcons";

type Props = NativeStackScreenProps<RootStackParamList, "About">;

export function AboutScreen({ navigation }: Props) {
  const { t } = useTranslation(["about", "common"]);
  const { storage } = useTentacleConfig();

  const serverUrl = storage.getItem("tentacle_server_url") || "-";
  const userRaw = storage.getItem("tentacle_user");
  let username = "-";
  if (userRaw) {
    try { username = JSON.parse(userRaw).username || userRaw; } catch { username = userRaw; }
  }

  const features = [
    t("about:featurePlayer"),
    t("about:featureResume"),
    t("about:featureRequests"),
    t("about:featureAdaptive"),
    t("about:featureNotifications"),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0f" }}>
      <ScrollView contentContainerStyle={{ padding: 48, paddingBottom: 80 }}>
        {/* Back button */}
        <Focusable onPress={() => navigation.goBack()} hasTVPreferredFocus>
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignSelf: "flex-start", marginBottom: 32 }}>
            <Text style={{ color: "#c4b5fd", fontSize: 16, fontWeight: "600" }}>
              {t("common:back")}
            </Text>
          </View>
        </Focusable>

        {/* Logo + title */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <TentacleIcon size={72} color="#8b5cf6" />
          <Text style={{ color: "#fff", fontSize: 36, fontWeight: "900", marginTop: 16 }}>
            Tentacle
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 17, marginTop: 4 }}>
            {t("about:version", { version: APP_VERSION })}
          </Text>
        </View>

        {/* Description */}
        <View style={{ backgroundColor: "#12121a", borderRadius: 12, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: "#1e1e2e" }}>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, lineHeight: 24, textAlign: "center" }}>
            {t("about:description")}
          </Text>
        </View>

        {/* Server info */}
        <View style={{ backgroundColor: "#12121a", borderRadius: 12, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: "#1e1e2e" }}>
          <InfoRow label="Server" value={serverUrl} />
          <InfoRow label="User" value={username} />
          <InfoRow label="Platform" value="Android TV" />
        </View>

        {/* Features */}
        <View style={{ backgroundColor: "#12121a", borderRadius: 12, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: "#1e1e2e" }}>
          <Text style={{ color: "#c4b5fd", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
            {t("about:features")}
          </Text>
          {features.map((f, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#8b5cf6", marginRight: 12 }} />
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Copyright */}
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", marginTop: 16 }}>
          {t("about:copyright", { version: APP_VERSION, year: new Date().getFullYear() })}
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>{label}</Text>
      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
