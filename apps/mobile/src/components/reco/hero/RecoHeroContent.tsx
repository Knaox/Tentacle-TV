import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Sparkles, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { Badge } from "@/components/ui";
import { CascadeGroup } from "@/components/hero/CascadeGroup";
import { HeroEyebrow } from "@/components/hero/HeroEyebrow";
import { makeHeroCtaStyles } from "@/components/hero/heroCtaStyles";
import { firstReasonText } from "@/components/reco/RecoReasonList";
import { typography, FONT_FAMILY, useResponsive, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  item: RecoRowItem;
  /** Le slide est celui affiché — sa cascade de texte se (re)joue. */
  active: boolean;
  /** Faux : nulle part où aller (hors bibliothèque, sans catalogue Vigie) — pas de bouton. */
  canOpen: boolean;
  onOpen: (item: RecoRowItem) => void;
}

/**
 * Le bloc texte d'une diapositive de recommandation : sur-titre « Sélectionné
 * pour vous », titre, année, note, badge « À la demande » hors bibliothèque,
 * la première raison en pastille, et le bouton qui ouvre la fiche (Jellyfin
 * ou catalogue). Mêmes couleurs que le web : tout est posé sur l'affiche,
 * donc en `onMedia.*` ; l'étoile est de MARQUE (rose), jamais dorée ; seule
 * la pastille de raison porte une teinte violette.
 */
export function RecoHeroContent({ item, active, canOpen, onOpen }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const cta = useThemedStyles(makeHeroCtaStyles);
  const { isTablet } = useResponsive();
  const onDemand = item.jellyfinItemId === null;
  const reason = firstReasonText(item.reasons, t);
  const ctaLabel = onDemand ? t("heroOpenVigie") : t("heroOpenDetail");

  return (
    <View>
      <CascadeGroup order={0} active={active}>
        <View style={st.kicker}>
          <HeroEyebrow label={t("heroForYou")} />
        </View>
        <Text style={[st.title, isTablet && st.titleTablet]} numberOfLines={2} maxFontSizeMultiplier={1.15}>
          {item.title}
        </Text>
      </CascadeGroup>

      <CascadeGroup order={1} active={active}>
        <View style={st.meta}>
          {item.year != null && <Text style={st.metaTxt}>{item.year}</Text>}
          {item.voteAverage != null && item.voteAverage > 0 && (
            <View style={st.ratingBox}>
              <Star size={12} color={theme.colors.brand.accent} fill={theme.colors.brand.accent} />
              <Text style={st.rating}>{item.voteAverage.toFixed(1)}</Text>
            </View>
          )}
          {onDemand && <Badge label={t("onDemandBadge")} variant="onMedia" style={st.onDemand} />}
        </View>
        {reason && (
          <View style={st.reasonPill}>
            <Sparkles size={12} color={theme.colors.brand.accentLight} />
            <Text style={[st.reason, isTablet && st.reasonTablet]} numberOfLines={2}>{reason}</Text>
          </View>
        )}
      </CascadeGroup>

      <CascadeGroup order={2} active={active}>
        {canOpen && (
          <View style={cta.btns}>
            <Pressable
              style={({ pressed }) => [cta.playBtn, isTablet && cta.playBtnTablet, pressed && cta.pressed]}
              onPress={() => onOpen(item)}
              accessibilityRole="button"
              accessibilityLabel={`${ctaLabel} ${item.title}`}
            >
              <Feather name={onDemand ? "compass" : "info"} size={18} color={theme.colors.cta.primaryFg} />
              <Text style={cta.playTxt}>{ctaLabel}</Text>
            </Pressable>
          </View>
        )}
      </CascadeGroup>
    </View>
  );
}

// Posé DIRECTEMENT sur l'affiche → onMedia.* (constant dans les deux thèmes).
const makeStyles = (t: AppTheme) => StyleSheet.create({
  kicker: { marginBottom: 10 },
  title: { fontSize: 32, fontFamily: FONT_FAMILY.extrabold, color: t.colors.onMedia.primary, marginBottom: 12, letterSpacing: -0.6, lineHeight: 36, textShadowColor: t.colors.onMedia.shadow, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12 },
  titleTablet: { fontSize: 46, lineHeight: 52, marginBottom: 16 },
  meta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 10, flexWrap: "wrap" as const },
  metaTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.onMedia.secondary },
  ratingBox: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  rating: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.onMedia.primary },
  onDemand: { borderRadius: 999, paddingHorizontal: 10 },
  // La raison : pastille informative teintée de marque, libre sur deux lignes.
  reasonPill: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6, alignSelf: "flex-start" as const,
    maxWidth: "100%" as const, marginBottom: 18, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: withAlpha(t.colors.brand.violet, 0.5, t.colors.brand.glow),
    backgroundColor: withAlpha(t.colors.brand.violet, 0.24, t.colors.brand.ghost),
  },
  reason: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.onMedia.primary, lineHeight: 17, flexShrink: 1, textShadowColor: t.colors.onMedia.shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  reasonTablet: { fontSize: 14, lineHeight: 19 },
});
