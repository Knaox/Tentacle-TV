import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { FONT_FAMILY, useTheme } from "@/theme";

const LANGUAGES = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
] as const;

/**
 * Le choix de langue d'avant connexion — il n'y a pas encore de profil où le
 * faire. Écrit par l'adaptateur de stockage (et non AsyncStorage en direct)
 * pour que son cache et le disque restent d'accord ; `tentacle_language` est
 * la clé relue au démarrage.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation("auth");
  const { storage } = useTentacleConfig();
  const { colors } = useTheme();
  const current = i18n.language?.startsWith("fr") ? "fr" : "en";

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("language")}
      style={{ flexDirection: "row", borderRadius: 999, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.fill.faint, padding: 2 }}
    >
      {LANGUAGES.map(({ code, name }) => {
        const active = current === code;
        return (
          <Pressable
            key={code}
            onPress={() => {
              void i18n.changeLanguage(code);
              storage.setItem("tentacle_language", code);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={name}
            hitSlop={4}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 36,
              paddingHorizontal: 12,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.brand.soft : "transparent",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 12, letterSpacing: 0.5, fontFamily: FONT_FAMILY.bold, color: active ? colors.brand.light : colors.text.tertiary }}>
              {code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
