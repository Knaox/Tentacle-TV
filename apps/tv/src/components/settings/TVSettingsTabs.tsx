import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Colors } from "../../theme/colors";

export type SettingsSection = "account" | "playback" | "about";

const SECTIONS: Array<{ id: SettingsSection; labelKey: string }> = [
  { id: "account", labelKey: "preferences:sectionAccount" },
  { id: "playback", labelKey: "preferences:sectionPlayback" },
  { id: "about", labelKey: "nav:about" },
];

/**
 * La colonne des trois sections — Compte · Lecture · À propos, comme la
 * coquille de réglages de la LG (`SettingsTv`). L'entrée de focus vise la
 * section AFFICHÉE, jamais une action du panneau.
 */
export function TVSettingsTabs({
  active,
  onSelect,
}: {
  active: SettingsSection;
  onSelect: (id: SettingsSection) => void;
}) {
  const { t } = useTranslation(["preferences", "nav"]);

  return (
    <View style={{ width: 250, gap: 8 }}>
      {SECTIONS.map((section) => {
        const isActive = section.id === active;
        return (
          <Focusable
            key={section.id}
            variant="row"
            onPress={() => onSelect(section.id)}
            hasTVPreferredFocus={isActive}
            accessibilityLabel={t(section.labelKey)}
          >
            <View
              style={{
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: 12,
                backgroundColor: isActive ? "rgba(255,255,255,0.10)" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: isActive ? "700" : "500",
                  color: isActive ? Colors.textPrimary : Colors.textSecondary,
                }}
              >
                {t(section.labelKey)}
              </Text>
            </View>
          </Focusable>
        );
      })}
    </View>
  );
}
