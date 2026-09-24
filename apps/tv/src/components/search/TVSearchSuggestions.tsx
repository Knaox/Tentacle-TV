import { memo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { SearchIcon } from "../icons/TVIcons";
import { Colors } from "../../theme/colors";
import { Button } from "../../theme/buttons";

export interface TVSearchSuggestion {
  /** Ce qui remplace la saisie quand on la choisit. */
  query: string;
  /** La complétion du meilleur résultat (mise en avant), ou une requête proposée. */
  kind: "complete" | "query";
}

export const SUGGESTION_ROW_HEIGHT = 52;

/**
 * Les suggestions, sous le clavier : quatre lettres tapées, et « Harry
 * Potter » s'obtient d'un appui au lieu de huit. D'abord la complétion du
 * meilleur résultat, puis ce que le moteur propose — correction, franchise,
 * personne, collection (cf. `suggestionsFrom`). Une liste courte et stable :
 * au D-pad, chaque ligne coûte un appui.
 */
export const TVSearchSuggestions = memo(function TVSearchSuggestions({ width, suggestions, onPick }: {
  width: number;
  suggestions: TVSearchSuggestion[];
  onPick: (query: string) => void;
}) {
  const { t } = useTranslation("search");
  if (suggestions.length === 0) return null;

  return (
    <View style={{ width, marginTop: 24 }}>
      <Text style={{
        color: Colors.textTertiary, fontSize: 13, fontWeight: "700", letterSpacing: 1.4,
        textTransform: "uppercase", marginBottom: 10,
      }}>
        {t("suggestions")}
      </Text>
      {suggestions.map((s) => (
        <Focusable
          key={`${s.kind}:${s.query}`}
          variant="button"
          focusRadius={Button.small.borderRadius}
          onPress={() => onPick(s.query)}
          accessibilityLabel={s.query}
          style={{ marginBottom: 6 }}
        >
          <View style={{
            width, height: SUGGESTION_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 14,
            paddingHorizontal: 16, borderRadius: Button.small.borderRadius,
            backgroundColor: s.kind === "complete" ? "rgba(255,255,255,0.08)" : "transparent",
          }}>
            <SearchIcon size={18} color={s.kind === "complete" ? Colors.accentPurpleLight : Colors.textTertiary} />
            <Text numberOfLines={1} style={{
              flex: 1, fontSize: 20,
              color: s.kind === "complete" ? Colors.textPrimary : Colors.textSecondary,
              fontWeight: s.kind === "complete" ? "600" : "400",
            }}>
              {s.query}
            </Text>
          </View>
        </Focusable>
      ))}
    </View>
  );
});
