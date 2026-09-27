import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useDeleteRating, useItemRating, useRateItem, type RatingIdentity } from "@tentacle-tv/api-client";
import { FONT_FAMILY, RADIUS, progressGradient, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { StarRatingMobile } from "./StarRatingMobile";

// expo-haptics optionnel, comme dans la feuille d'appui long.
let Haptics: { selectionAsync: () => void } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* ignore */ }

interface Props {
  /** Identité de notation (`ratingIdentityForItem`, `episodeRatingIdentityFor`). Null : rien n'est rendu. */
  identity: RatingIdentity | null;
  /** L'item Jellyfin noté — permet aux cartes de retrouver la note par identifiant. */
  jellyfinItemId?: string | null;
  /** `sheet` : dans la feuille d'appui long (sans cadre, étoiles plus grandes). */
  variant?: "detail" | "sheet";
}

/**
 * Noter un titre sur le mobile — fiche et feuille d'appui long.
 *
 * La note passe par le MOTEUR DE NOTES de Tentacle (`/api/ratings`, clé
 * tmdb), pas par Jellyfin : Jellyfin n'a pas de note personnelle sur dix — son
 * seul « j'aime » (`UserData.Likes`) porte déjà « Ma liste », et sa
 * `CommunityRating` est une métadonnée globale, commune à tous les comptes.
 * Le moteur, lui, est par compte, synchronisé vers les services externes
 * reliés, et c'est lui que lisent les recommandations. Le web et l'affiche de
 * fin du lecteur y écrivent déjà : le mobile rejoint la même source.
 *
 * Cinq étoiles, dix niveaux ; toucher de nouveau sa note la retire. Écriture
 * optimiste (`useRateItem`) : la pastille des cartes suit aussitôt.
 */
export function RatingPanelMobile({ identity, jellyfinItemId, variant = "detail" }: Props) {
  const { t } = useTranslation("cards");
  const { t: tReco } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const rating = useItemRating(identity, { enabled: identity !== null });
  const rate = useRateItem();
  const remove = useDeleteRating();
  if (!identity) return null;

  const value = rating?.score ?? null;
  const gradient = progressGradient(theme.colors.brand);

  return (
    <View style={variant === "sheet" ? st.sheet : st.card}>
      <View style={st.header}>
        <Text style={st.title}>{value != null ? tReco("yourRating") : t("rateTitle")}</Text>
        {value != null && (
          <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.valuePill}>
            <Text style={st.valueText}>{tReco("ratingValue", { score: value })}</Text>
          </LinearGradient>
        )}
      </View>
      <StarRatingMobile
        value={value}
        size={variant === "sheet" ? 34 : 30}
        outlineColor={theme.colors.text.tertiary}
        onRate={(score) => {
          Haptics?.selectionAsync();
          rate.mutate({ ...identity, jellyfinItemId: jellyfinItemId ?? undefined, score });
        }}
        onClear={() => {
          Haptics?.selectionAsync();
          remove.mutate(identity);
        }}
      />
      <Text style={st.hint}>{value != null ? t("ratedHint") : t("rateHint")}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: spacing.screenPadding,
      marginTop: spacing.lg,
      padding: spacing.md,
      gap: spacing.sm,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    sheet: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.sm,
      alignItems: "center",
    },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    title: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.bold,
      color: t.colors.text.secondary,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    valuePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    valueText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: FONT_FAMILY.bold,
      color: t.colors.cta.brandFg,
      fontVariant: ["tabular-nums"],
    },
    hint: { ...typography.caption, color: t.colors.text.quaternary },
  });
