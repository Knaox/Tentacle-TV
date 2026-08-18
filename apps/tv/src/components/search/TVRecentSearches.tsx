import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Colors, Typography } from "../../theme/colors";

/**
 * Les recherches récentes, en pastilles — parité `recherche-tv-recente`
 * (webOS) : padding 12/24, texte 19, rayon pilule. Appuyer relance la
 * recherche telle qu'elle avait été tapée.
 */
export function TVRecentSearches({
  recents,
  onPick,
}: {
  recents: string[];
  onPick: (query: string) => void;
}) {
  const { t } = useTranslation("common");
  if (recents.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
      <Text style={{ color: Colors.textSecondary, ...Typography.sectionTitle, marginBottom: 16 }}>
        {t("recentSearches")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {recents.map((recent) => (
          <Focusable
            key={recent}
            variant="button"
            focusRadius={999}
            onPress={() => onPick(recent)}
            accessibilityLabel={recent}
          >
            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 999,
                backgroundColor: Colors.ctaGhostBg,
                borderWidth: 1,
                borderColor: Colors.glassBorder,
              }}
            >
              <Text style={{ color: Colors.textPrimary, fontSize: 19 }}>{recent}</Text>
            </View>
          </Focusable>
        ))}
      </View>
    </View>
  );
}
