import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { RecoReason } from "@tentacle-tv/api-client";
import { externalCardActionEntries, resolveExternalCardOverlay, type ExternalCardVariant } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui";
import { ActionCell } from "@/components/ActionCell";
import { BookmarkGlyph } from "@/components/cards/cardGlyphs";
import { RecoReasonList } from "@/components/reco/RecoReasonList";
import { RatingPanelMobile } from "@/components/rating/RatingPanelMobile";
import { FONT_FAMILY, RADIUS, SHADOW_RN, progressGradient, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useExternalTitleActions, type ExternalTitle } from "./useExternalTitle";

/** Ce que la feuille montre d'un titre hors bibliothèque. */
export interface ExternalSheetTarget {
  title: ExternalTitle;
  name: string;
  year: number | null;
  imageUrl: string | null;
}

interface Props {
  target: ExternalSheetTarget | null;
  variant: ExternalCardVariant;
  onClose: () => void;
  /** Les raisons d'une recommandation, sous l'en-tête. */
  reasons?: readonly RecoReason[];
  /** « Ne plus me proposer » — une recommandation seulement. */
  onDismiss?: () => void;
  /** La page de l'extension, ouverte par l'appelant (depuis une modale, il la referme d'abord). */
  openHref?: (href: string) => void;
}

/**
 * La feuille de l'appui long d'une carte HORS bibliothèque — le pendant
 * tactile du survol des cartes Vigie (`externalCardOverlay.ts`), dans l'ordre
 * que le modèle fixe : « Demander », puis la bascule « Ma liste à l'arrivée »
 * et, sur une recommandation, « Ne plus me proposer » ; la note en dessous,
 * comme sur `MediaActionSheet`. La même au téléphone que dans l'extension.
 */
export function ExternalActionSheet({ target, variant, onClose, reasons, onDismiss, openHref }: Props) {
  // La feuille descend encore un instant après sa fermeture : elle garde son titre.
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);
  const body = target ?? shown;
  return (
    <BottomSheet visible={target !== null} onClose={onClose} snapPoints={[0.62, 0.9]}>
      {body && (
        <SheetBody target={body} variant={variant} onClose={onClose} reasons={reasons} onDismiss={onDismiss} openHref={openHref} />
      )}
    </BottomSheet>
  );
}

function SheetBody({ target, variant, onClose, reasons, onDismiss, openHref }: Props & { target: ExternalSheetTarget }) {
  const { t } = useTranslation("cards");
  const { t: tc } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const actions = useExternalTitleActions(target.title, openHref, onClose);
  const overlay = resolveExternalCardOverlay({ variant, request: actions.state?.request ?? null, identified: true });
  const entries = externalCardActionEntries(overlay, { watchlist: actions.pending });
  const request = entries.find((e) => e.kind === "request");
  const gradient = progressGradient(theme.colors.brand);
  const type = target.title.mediaType === "tv" ? tc("series") : tc("movie");

  return (
    <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
      <View style={st.hero}>
        <View style={st.posterWrap}>
          {target.imageUrl ? (
            <Image source={{ uri: target.imageUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <Feather name={target.title.mediaType === "tv" ? "tv" : "film"} size={22} color={theme.colors.text.quaternary} />
          )}
        </View>
        <View style={st.heroText}>
          <Text style={st.title} numberOfLines={2}>{target.name}</Text>
          <Text style={st.meta} numberOfLines={1}>{[target.year, type].filter(Boolean).join(" · ")}</Text>
          {actions.state?.badge && <Text style={st.badge} numberOfLines={1}>{actions.state.badge.label}</Text>}
        </View>
      </View>

      {reasons && reasons.length > 0 && (
        <View style={st.reasons}>
          <RecoReasonList reasons={[...reasons]} />
        </View>
      )}

      {request && (
        <Pressable
          onPress={actions.request}
          disabled={actions.requesting}
          accessibilityRole="button"
          accessibilityLabel={`${request.label} — ${target.name}`}
          style={({ pressed }) => [st.ctaWrap, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.cta}>
            {actions.requesting
              ? <ActivityIndicator color={theme.colors.cta.brandFg} />
              : <Feather name="plus" size={18} color={theme.colors.cta.brandFg} />}
            <Text style={st.ctaText}>{request.label}</Text>
          </LinearGradient>
        </Pressable>
      )}
      {actions.outcome && (
        <Text style={[st.outcome, { color: actions.outcome.ok ? theme.colors.brand.light : theme.colors.status.error }]}>
          {actions.outcome.message}
        </Text>
      )}

      <View style={st.grid}>
        {entries.map((entry) => {
          if (entry.kind === "watchlist") {
            return (
              <ActionCell
                key="watchlist"
                // Le signet de la pastille d'états (tracé partagé), plein une fois mis de côté.
                renderIcon={(color) => <BookmarkGlyph size={26} color={color} filled={entry.active === true} />}
                label={t(entry.active ? "watchlistOnArrival" : "addToWatchlistOnArrival")}
                active={entry.active === true}
                activeColor={theme.colors.brand.violet}
                onPress={actions.toggleWatchlist}
              />
            );
          }
          if (entry.kind === "dismiss" && onDismiss) {
            return (
              <ActionCell
                key="dismiss"
                icon="eye-off"
                label={t("dismiss")}
                onPress={() => { onDismiss(); onClose(); }}
              />
            );
          }
          return null;
        })}
      </View>

      {overlay.rate && <RatingPanelMobile identity={actions.ratingIdentity} jellyfinItemId={null} variant="sheet" />}
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingBottom: spacing.xl },
    hero: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg },
    posterWrap: {
      width: 52, height: 76, borderRadius: RADIUS.sm, overflow: "hidden" as const,
      alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: t.colors.surface.s2, ...SHADOW_RN.elev2,
    },
    heroText: { flex: 1, minWidth: 0 },
    title: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2, marginBottom: 3 },
    meta: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.brand.light, letterSpacing: 0.2 },
    badge: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, marginTop: 4 },
    reasons: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
    ctaWrap: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: RADIUS.pill, overflow: "hidden" as const },
    cta: { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: spacing.sm, paddingHorizontal: spacing.lg },
    ctaText: { fontSize: 15, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.brandFg },
    outcome: { ...typography.caption, fontFamily: FONT_FAMILY.medium, marginHorizontal: spacing.lg, marginBottom: spacing.md, textAlign: "center" as const },
    grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  });
