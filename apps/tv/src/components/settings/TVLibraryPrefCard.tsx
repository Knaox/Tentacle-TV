import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_RADIUS } from "@tentacle-tv/theme";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

export interface TvSetting {
  key: "audio" | "mode" | "sousTitres";
  label: string;
  value: string;
  choices: Array<{ value: string; label: string }>;
  selection: string | null;
}

/**
 * Les trois réglages de piste d'une bibliothèque — parité `LibraryCardTv`
 * (LG) : une carte (rayon 20, liseré, fond de surface), trois boutons qui
 * disent ce qu'ils règlent et où ils en sont, et « Réinitialiser » SEULEMENT
 * si une préférence existe. Chaque bouton ouvre le panneau de choix — c'est
 * lui qui porte la liste et le confinement du focus.
 */
export function TVLibraryPrefCard({
  name,
  settings,
  customized,
  onOpen,
  onReset,
}: {
  name: string;
  settings: TvSetting[];
  customized: boolean;
  onOpen: (setting: TvSetting) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation("preferences");

  return (
    <View
      style={{
        borderRadius: TV_RADIUS.lg,
        borderWidth: 1,
        borderColor: brandAlpha(0.22),
        backgroundColor: Colors.bgSurface,
        paddingVertical: 24,
        paddingHorizontal: 28,
      }}
    >
      <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "600" }}>{name}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20 }}>
        {settings.map((setting) => (
          <Focusable
            key={setting.key}
            variant="button"
            focusRadius={Button.medium.borderRadius}
            scaleOverride={1.04}
            onPress={() => onOpen(setting)}
            accessibilityLabel={`${setting.label} : ${setting.value}`}
          >
            <View
              style={{
                minWidth: 220,
                ...Button.medium,
                borderWidth: 1,
                borderColor: Colors.glassBorder,
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color: Colors.textTertiary,
                  fontSize: 13,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {setting.label}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: "600", marginTop: 4 }}
              >
                {setting.value}
              </Text>
            </View>
          </Focusable>
        ))}
      </View>

      {customized && (
        <View style={{ flexDirection: "row", marginTop: 20 }}>
          <Focusable variant="button" focusRadius={Button.pill.borderRadius} onPress={onReset} accessibilityLabel={t("reset")}>
            <View
              style={{
                paddingHorizontal: 22,
                paddingVertical: 11,
                ...Button.pill,
                backgroundColor: Colors.ctaGhostBg,
                borderWidth: 1,
                borderColor: Colors.ctaGhostBorder,
              }}
            >
              <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                {t("reset")}
              </Text>
            </View>
          </Focusable>
        </View>
      )}
    </View>
  );
}
