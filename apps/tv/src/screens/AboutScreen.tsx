import { View, ScrollView, Text, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";

// Source unique des versions : versions.json à la racine du monorepo (champ tv).
const APP_VERSION: string = require("../../../../versions.json").tv ?? "0.9.2";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { TentacleLogo } from "../components/icons/TentacleLogo";
import { useTVRemote } from "../components/focus/useTVRemote";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { TV_PLATFORM_LABEL } from "../lib/platformLabel";
import { Colors, Radius } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "About">;

export function AboutScreen({ navigation }: Props) {
  const { t } = useTranslation(["about", "common"]);
  const { storage } = useTentacleConfig();
  // Publie la carte description comme focusable d'entrée (sortie rail + auto-collapse).
  const contentRef = useTVContentEntry();

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
    <TVScreenFrame>
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <ScrollView contentContainerStyle={{
        paddingHorizontal: 80,
        paddingBottom: 48,
      }}>

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

        {/* Description — focusable : cible d'entrée/sortie du rail sur tvOS
            (À propos n'a aucun bouton ; le focus doit pouvoir y entrer). */}
        <Focusable
          ref={contentRef}
          variant="card"
          focusRadius={Radius.card}
          onPress={() => {}}
          hasTVPreferredFocus={Platform.OS === "ios"}
          style={{ marginBottom: 16 }}
          accessibilityLabel={t("about:description")}
        >
          <View style={{
            backgroundColor: Colors.bgSurface,
            borderRadius: Radius.card, padding: 20,
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <Text style={{
              color: Colors.textSecondary,
              fontSize: 13, lineHeight: 20, textAlign: "center",
            }}>
              {t("about:description")}
            </Text>
          </View>
        </Focusable>

        {/* Server info */}
        <Focusable variant="card" focusRadius={Radius.card} onPress={() => {}} style={{ marginBottom: 16 }}>
          <View style={{
            backgroundColor: Colors.bgSurface,
            borderRadius: Radius.card, padding: 20,
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <InfoRow label="Server" value={serverUrl} />
            <InfoRow label="User" value={username} />
            <InfoRow label="Platform" value={TV_PLATFORM_LABEL} />
          </View>
        </Focusable>

        {/* Features */}
        <Focusable variant="card" focusRadius={Radius.card} onPress={() => {}} style={{ marginBottom: 16 }}>
          <View style={{
            backgroundColor: Colors.bgSurface,
            borderRadius: Radius.card, padding: 20,
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
        </Focusable>

        {/* Copyright */}
        <Text style={{
          color: Colors.textTertiary, fontSize: 11,
          textAlign: "center", marginTop: 12,
        }}>
          {t("about:copyright", { version: APP_VERSION, year: new Date().getFullYear() })}
        </Text>
      </ScrollView>
    </View>
    </TVScreenFrame>
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
