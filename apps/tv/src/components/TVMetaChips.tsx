import { memo } from "react";
import { View, Text } from "react-native";
import { extractMediaQuality, type MediaItem } from "@tentacle-tv/shared";
import { Colors, Fonts, brandAlpha } from "../theme/colors";

interface MetaChip {
  label: string;
  accent?: boolean;
}

/** Les puces d'un item, dans leur ordre — vide : l'item ne porte pas ses
 *  flux (résultat de recherche, recommandation, tuile de lot). */
function metaChipList(item: MediaItem, compact: boolean): MetaChip[] {
  const q = extractMediaQuality(item);
  const chips: MetaChip[] = [];
  if (q.resolution) chips.push({ label: q.resolution, accent: q.resolution === "4K" });
  if (q.isDolbyVision) chips.push({ label: compact ? "DV" : "Dolby Vision" });
  else if (q.isHDR) chips.push({ label: "HDR" });
  if (q.isDolbyAtmos) chips.push({ label: "Atmos" });
  else if (!compact && q.surroundLabel) chips.push({ label: q.surroundLabel });
  for (const lang of q.audioLabels.slice(0, compact ? 2 : 3)) chips.push({ label: lang.token });
  return chips;
}

/**
 * Vrai quand `TVMetaChips` rendrait quelque chose. Une carte n'efface sa note
 * au focus QUE si les puces viennent réellement à sa place : sans flux connus,
 * elle effaçait sa note pour ne rien montrer.
 */
export function hasMetaChips(item: MediaItem, compact = false): boolean {
  return metaChipList(item, compact).length > 0;
}

/**
 * Chips qualité/langues — équivalent TV des MetaChips web : tokens texte
 * monochromes discrets, seul le 4K est accentué (brand).
 * `compact` = densité réduite pour les overlays d'affiches (CardMetaOverlay
 * web `density="compact"`) : fond sombre lisible sur image.
 */
export const TVMetaChips = memo(function TVMetaChips({ item, compact = false, wrap = true }: {
  item: MediaItem;
  compact?: boolean;
  /** Faux : une seule ligne, rognée — pour une ligne de liste à hauteur fixe,
   *  où un retour à la ligne pousserait le synopsis hors de la case. */
  wrap?: boolean;
}) {
  const chips = metaChipList(item, compact);
  if (chips.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", overflow: wrap ? "visible" : "hidden", gap: compact ? 4 : 6 }}>
      {chips.map((c) => (
        <View
          key={c.label}
          style={{
            paddingHorizontal: compact ? 5 : 7,
            paddingVertical: 2,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: c.accent ? brandAlpha(0.55) : compact ? "rgba(255,255,255,0.18)" : Colors.border,
            backgroundColor: c.accent
              ? (compact ? brandAlpha(0.40) : brandAlpha(0.18))
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
