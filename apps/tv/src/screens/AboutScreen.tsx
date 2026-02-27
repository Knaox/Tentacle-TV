import { View, ScrollView, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { APP_VERSION } from "@tentacle-tv/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { TentacleLogo } from "../components/icons/TentacleLogo";
import { useTVRemote } from "../components/focus/useTVRemote";
import { Colors, Spacing, Typography, Radius } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "About">;

export function AboutScreen({ navigation }: Props) {
  const { t } = useTranslation(["about", "common"]);
  const { storage } = useTentacleConfig();

  useTVRemote({ onBack: () => navigation.goBack() });

  const serverUrl = storage.getItem("tentacle_server_url") || "-";
  const userRaw = storage.getItem("tentacle_user");
  let username = "-";
  if (userRaw) {
    try {
      const parsed = JSON.parse(userRaw);
      username = parsed.Name || parsed.username || parsed.name || userRaw;
    } catch { username = userRaw; }
  }

  const features = [
    t("about:featurePlayer"),
    t("about:featureResume"),
    t("about:featureRequests"),
    t("about:featureAdaptive"),
    t("about:featureNotifications"),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <ScrollView contentContainerStyle={{
        paddingHorizontal: 80,
        paddingVertical: 32,
        paddingBottom: 60,
      }}>
        {/* Back button — alignSelf so focus ring wraps just the button */}
        <Focusable onPress={() => navigation.goBack()} hasTVPreferredFocus style={{ alignSelf: "flex-start", marginBottom: 28 }}>
          <View style={{
            paddingHorizontal: 16, paddingVertical: 8,
            borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <Text style={{ color: Colors.accentPurpleLight, fontSize: 14, fontWeight: "600" }}>
              {t("common:back")}
            </Text>
          </View>
        </Focusable>

        {/* Logo + title */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <TentacleLogo size={72} />
          <Text style={{
            color: Colors.accentPurple,
            fontSize: 28, fontWeight: "900",
            marginTop: 14,
          }}>
            Tentacle TV
          </Text>
          <Text style={{
            color: Colors.textMuted,
            fontSize: 14, marginTop: 4,
          }}>
            {t("about:version", { version: APP_VERSION })}
          </Text>
        </View>

        {/* Description */}
        <View style={{
          backgroundColor: Colors.bgSurface,
          borderRadius: Radius.card, padding: 20,
          marginBottom: 16,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <Text style={{
            color: Colors.textSecondary,
            fontSize: 13, lineHeight: 20, textAlign: "center",
          }}>
            {t("about:description")}
          </Text>
        </View>

        {/* Server info */}
        <View style={{
          backgroundColor: Colors.bgSurface,
          borderRadius: Radius.card, padding: 20,
          marginBottom: 16,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <InfoRow label="Server" value={serverUrl} />
          <InfoRow label="User" value={username} />
          <InfoRow label="Platform" value="Android TV" />
        </View>

        {/* Features */}
        <View style={{
          backgroundColor: Colors.bgSurface,
          borderRadius: Radius.card, padding: 20,
          marginBottom: 16,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <Text style={{
            color: Colors.accentPurpleLight,
            fontSize: 15, fontWeight: "700", marginBottom: 12,
          }}>
            {t("about:features")}
          </Text>
          {features.map((f, i) => (
            <View key={i} style={{
              flexDirection: "row", alignItems: "center", marginBottom: 8,
            }}>
              <View style={{
                width: 5, height: 5, borderRadius: 3,
                backgroundColor: Colors.accentPurple, marginRight: 12,
              }} />
              <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Copyright */}
        <Text style={{
          color: Colors.textTertiary, fontSize: 11,
          textAlign: "center", marginTop: 12,
        }}>
          {t("about:copyright", { version: APP_VERSION, year: new Date().getFullYear() })}
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{
      flexDirection: "row", justifyContent: "space-between",
      marginBottom: 8,
    }}>
      <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
