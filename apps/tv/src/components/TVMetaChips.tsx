import { memo } from "react";
import { View, Text } from "react-native";
import { extractMediaQuality, type MediaItem } from "@tentacle-tv/shared";
import { Colors, Fonts } from "../theme/colors";

/**
 * Chips qualité/langues — équivalent TV des MetaChips web : tokens texte
 * monochromes discrets, seul le 4K est accentué (brand).
 * `compact` = densité réduite pour les overlays d'affiches (CardMetaOverlay
 * web `density="compact"`) : fond sombre lisible sur image.
 */
export const TVMetaChips = memo(function TVMetaChips({ item, compact = false }: { item: MediaItem; compact?: boolean }) {
  const q = extractMediaQuality(item);
  const chips: Array<{ label: string; accent?: boolean }> = [];

  if (q.resolution) chips.push({ label: q.resolution, accent: q.resolution === "4K" });
  if (q.isDolbyVision) chips.push({ label: compact ? "DV" : "Dolby Vision" });
  else if (q.isHDR) chips.push({ label: "HDR" });
  if (q.isDolbyAtmos) chips.push({ label: "Atmos" });
  else if (!compact && q.surroundLabel) chips.push({ label: q.surroundLabel });
  for (const lang of q.audioLabels.slice(0, compact ? 2 : 3)) chips.push({ label: lang.token });

  if (chips.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: compact ? 4 : 6 }}>
      {chips.map((c) => (
        <View
          key={c.label}
          style={{
            paddingHorizontal: compact ? 5 : 7,
            paddingVertical: 2,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: c.accent ? "rgba(139, 92, 246, 0.55)" : compact ? "rgba(255,255,255,0.18)" : Colors.border,
            backgroundColor: c.accent
              ? (compact ? "rgba(139, 92, 246, 0.40)" : "rgba(139, 92, 246, 0.18)")
              : (compact ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.05)"),
          }}
        >
          <Text style={{
            color: c.accent ? (compact ? "#fff" : Colors.accentPurpleLight) : (compact ? "rgba(255,255,255,0.85)" : Colors.textTertiary),
            fontSize: compact ? 10 : 11,
            fontFamily: Fonts.semibold,
            letterSpacing: 0.4,
          }}>
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
});
