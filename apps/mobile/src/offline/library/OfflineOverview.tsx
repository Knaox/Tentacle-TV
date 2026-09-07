import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { makeMediaDetailStyles } from "@/screens/mediaDetailStyles";
import { spacing, CONTENT_MAX_WIDTH, useThemedStyles } from "@/theme";

/** Le synopsis d'une fiche locale : quatre lignes, puis « Voir plus » — le bloc de `DetailBody`. */
export function OfflineOverview({ text }: { text: string }) {
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeMediaDetailStyles);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  if (text.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg, maxWidth: CONTENT_MAX_WIDTH }}>
      <Text
        numberOfLines={expanded ? undefined : 4}
        style={st.overview}
        onTextLayout={(e) => {
          if (!expanded && e.nativeEvent.lines.length >= 4) setTruncated(true);
        }}
      >
        {text}
      </Text>
      {(truncated || expanded) && (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={expanded ? t("showLess") : t("showMore")}>
          <Text style={st.expandLink}>{expanded ? t("showLess") : t("showMore")}</Text>
        </Pressable>
      )}
    </View>
  );
}
