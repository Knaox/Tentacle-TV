import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OfflineVariantCard, OfflineVariantKind } from "@tentacle-tv/offline-core";
import { FONT_FAMILY, RADIUS, typography, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { formatBytes } from "../formatBytes";

interface Props {
  cards: readonly OfflineVariantCard[];
  value: OfflineVariantKind | null;
  onChange: (kind: OfflineVariantKind) => void;
}

/**
 * Les cartes de variante — Qualité d'origine · Qualité d'origine (MP4) ·
 * Allégé — dans l'ordre du plan. Invisibilité stricte : une variante absente
 * n'est ni grisée ni cadenassée, elle n'est pas rendue.
 */
export function VariantCards({ cards, value, onChange }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const st = useThemedStyles(makeStyles);

  const labelOf = (kind: OfflineVariantKind): [string, string] => {
    if (kind === "original") return [to("variantOriginal"), to("variantOriginalDesc")];
    if (kind === "remux") return [to("variantRemux"), to("variantRemuxDesc")];
    return [t("variantLight"), t("variantLightDesc")];
  };

  return (
    <View style={st.list}>
      {cards.map((card) => {
        const [label, description] = labelOf(card.kind);
        const selected = card.kind === value;
        const size = card.sizeBytes === null
          ? null
          : card.sizeIsEstimate
            ? t("estimatedSize", { size: formatBytes(card.sizeBytes) })
            : t("exactSize", { size: formatBytes(card.sizeBytes) });
        return (
          <Pressable
            key={card.kind}
            onPress={() => onChange(card.kind)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[st.card, selected && st.cardSelected]}
          >
            <View style={st.texts}>
              <Text style={[st.title, selected && st.titleSelected]}>{label}</Text>
              <Text style={st.description}>{description}</Text>
              {size && <Text style={st.size}>{size}</Text>}
            </View>
            <View style={[st.radio, selected && st.radioSelected]}>{selected && <View style={st.radioDot} />}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { gap: 8 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    cardSelected: {
      backgroundColor: withAlpha(t.colors.brand.violet, 0.14, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow),
    },
    texts: { flex: 1, gap: 2 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.bold, color: t.colors.text.secondary },
    titleSelected: { color: t.colors.text.primary },
    description: { ...typography.caption, color: t.colors.text.tertiary, lineHeight: 17 },
    size: { ...typography.caption, color: t.colors.text.quaternary, marginTop: 2 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: t.colors.border.strong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: { borderColor: t.colors.brand.violet },
    radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.brand.violet },
  });
