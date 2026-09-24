import { memo } from "react";
import { Text, View } from "react-native";
import { Colors } from "../../theme/colors";

/**
 * Une pastille de recherche (récente, genre, studio) — parité
 * `recherche-tv-recente` du LG : padding 12/24, texte 19, rayon pilule. Pur
 * visuel : l'appelant l'enveloppe dans un `Focusable variant="button"` au
 * rayon 999.
 */
export const TVSearchChip = memo(function TVSearchChip({ label, detail, capitalize = false }: {
  label: string;
  detail?: string;
  /** Des genres Jellyfin arrivent en minuscules (« action », « thriller ») :
   *  capitale à l'affichage seulement — la recherche garde le nom exact. Une
   *  recherche récente, elle, s'affiche telle qu'elle a été tapée. */
  capitalize?: boolean;
}) {
  const shown = capitalize ? label.charAt(0).toLocaleUpperCase() + label.slice(1) : label;
  return (
    <View style={{
      flexDirection: "row", alignItems: "baseline", gap: 10,
      paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999,
      backgroundColor: Colors.ctaGhostBg, borderWidth: 1, borderColor: Colors.glassBorder,
    }}>
      <Text style={{ color: Colors.textPrimary, fontSize: 19 }} numberOfLines={1}>{shown}</Text>
      {detail ? <Text style={{ color: Colors.textTertiary, fontSize: 15 }}>{detail}</Text> : null}
    </View>
  );
});
