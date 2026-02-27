import { View, ScrollView, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle/api-client";
import { APP_VERSION } from "@tentacle/shared";
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
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <ScrollView contentContainerStyle={{
        padding: Spacing.screenPadding,
        paddingBottom: 80,
      }}>
        {/* Back button */}
        <Focusable onPress={() => navigation.goBack()} hasTVPreferredFocus>
          <View style={{
            paddingHorizontal: 20, paddingVertical: 10,
            borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1, borderColor: Colors.glassBorder,
            alignSelf: "flex-start", marginBottom: 40,
          }}>
            <Text style={{ color: Colors.accentPurpleLight, ...Typography.buttonMedium }}>
              {t("common:back")}
            </Text>
          </View>
        </Focusable>

        {/* Logo + title */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <TentacleLogo size={96} />
          <Text style={{
            color: Colors.accentPurple,
            fontSize: 40, fontWeight: "900",
            marginTop: 20,
          }}>
            Tentacle
          </Text>
          <Text style={{
            color: Colors.textMuted,
            fontSize: 17, marginTop: 6,
          }}>
            {t("about:version", { version: APP_VERSION })}
          </Text>
        </View>

        {/* Description */}
        <View style={{
          backgroundColor: Colors.bgSurface,
          borderRadius: Radius.card, padding: Spacing.glassPadding,
          marginBottom: 24,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <Text style={{
            color: Colors.textSecondary,
            fontSize: 15, lineHeight: 24, textAlign: "center",
          }}>
            {t("about:description")}
          </Text>
        </View>

        {/* Server info */}
        <View style={{
          backgroundColor: Colors.bgSurface,
          borderRadius: Radius.card, padding: Spacing.glassPadding,
          marginBottom: 24,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <InfoRow label="Server" value={serverUrl} />
          <InfoRow label="User" value={username} />
          <InfoRow label="Platform" value="Android TV" />
        </View>

        {/* Features */}
        <View style={{
          backgroundColor: Colors.bgSurface,
          borderRadius: Radius.card, padding: Spacing.glassPadding,
          marginBottom: 24,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <Text style={{
            color: Colors.accentPurpleLight,
            fontSize: 18, fontWeight: "700", marginBottom: 16,
          }}>
            {t("about:features")}
          </Text>
          {features.map((f, i) => (
            <View key={i} style={{
              flexDirection: "row", alignItems: "center", marginBottom: 10,
            }}>
              <View style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: Colors.accentPurple, marginRight: 14,
              }} />
              <Text style={{ color: Colors.textSecondary, fontSize: 15 }}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Copyright */}
        <Text style={{
          color: Colors.textTertiary, fontSize: 13,
          textAlign: "center", marginTop: 20,
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
      marginBottom: 10,
    }}>
      <Text style={{ color: Colors.textTertiary, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
