import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { useTVRemote } from "../components/focus/useTVRemote";
import { TVSettingsTabs, type SettingsSection } from "../components/settings/TVSettingsTabs";
import { TVSettingsAccountSection } from "../components/settings/TVSettingsAccountSection";
import { TVSettingsPlaybackSection } from "../components/settings/TVSettingsPlaybackSection";
import { TVSettingsAboutSection } from "../components/settings/TVSettingsAboutSection";
import { Colors, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

/**
 * Les réglages, en UNE page à trois sections — Compte · Lecture · À propos
 * (parité `SettingsTv` webOS). Absorbe les anciens écrans Préférences et
 * À propos, et récupère « Changer de serveur » et « Déconnexion », descendus
 * du rail vers la section Compte. Les sections sont un état local : Retour
 * QUITTE les réglages d'un seul appui, il ne remonte pas les sections qu'on
 * vient de parcourir. Le panneau de réglages DANS le lecteur reste séparé :
 * il est par-lecture.
 */
export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation("preferences");
  const [section, setSection] = useState<SettingsSection>("account");

  useTVRemote({ onBack: () => navigation.goBack() });

  return (
    <TVScreenFrame>
      <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
        <Text style={{ color: Colors.textPrimary, ...Typography.pageTitle, marginBottom: 24 }}>
          {t("settingsTitle")}
        </Text>

        <View style={{ flex: 1, flexDirection: "row", gap: 40 }}>
          <TVSettingsTabs active={section} onSelect={setSection} />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 48, paddingRight: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {section === "account" && <TVSettingsAccountSection />}
            {section === "playback" && <TVSettingsPlaybackSection />}
            {section === "about" && <TVSettingsAboutSection />}
          </ScrollView>
        </View>
      </View>
    </TVScreenFrame>
  );
}
