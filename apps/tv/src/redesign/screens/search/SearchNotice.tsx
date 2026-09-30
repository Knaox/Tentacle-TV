import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts } from "../../theme/tokens";
import type { SearchNoticeModel } from "./searchViewModel";

/**
 * Une seule phrase au-dessus des résultats (`tvSearchNotice`) : la
 * correction (« Résultats pour « orgueil » », le terme retenu en blanc),
 * la réponse partielle, ou l'index encore en préparation. Non focalisable.
 */
export const SearchNotice = memo(function SearchNotice({ notice }: { notice: SearchNoticeModel }) {
  const correction = notice.kind === "correction";
  return (
    <GlassSurface radius={30} tone="regular" style={styles.pill}>
      <Icon name={correction ? "sparkles" : notice.kind === "indexing" ? "refresh" : "info"} size={26} color={correction ? colors.accentLight : colors.textSecondary} />
      <Text style={styles.text} numberOfLines={2}>
        {correction ? (
          <>
            {`${notice.lead} « `}
            <Text style={styles.term}>{notice.correction}</Text>
            {" »"}
          </>
        ) : (
          notice.text
        )}
      </Text>
    </GlassSurface>
  );
});

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingHorizontal: 26, paddingVertical: 12, maxWidth: 1100 },
  text: { ...fonts.medium, fontSize: 26, lineHeight: 34, color: colors.textSecondary, flexShrink: 1 },
  term: { ...fonts.bold, color: colors.text },
});
