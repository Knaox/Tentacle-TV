import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../color/artworkPalette";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { colors, fonts, text, white } from "../../theme/tokens";

/**
 * Ce qu'on montre à la place d'un écran qui n'a pas pu s'afficher (la
 * frontière d'erreur de chaque écran) : la pieuvre triste, ce qui s'est
 * passé, Réessayer (l'écran est remonté) — et la croix Retour en haut à
 * gauche, absente sur un écran racine. Le détail technique s'écrit en petit :
 * c'est la seule trace qu'on puisse transmettre d'un incident survenu devant
 * la télévision.
 *
 * Les textes viennent de `common` (`tvScreenErrorTitle`, `tvScreenErrorText`,
 * partagés avec webOS) : fini l'anglais en dur de l'ancien `ErrorBoundary`.
 * La navigation survit à l'écran fautif : l'intégration la passe (`nav`).
 * Clés : `screenError:retry`, `screenError:back` ; groupe `screenError:top` —
 * la bande de la croix, sur toute la largeur du contenu.
 */

export interface ScreenErrorViewProps {
  nav?: NavRailProps;
  palette?: ArtworkPalette;
  /** « TypeError: … » (nom et message, tronqués). */
  detail?: string;
  /** Faux sur un écran racine : pas de croix. */
  canGoBack?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
}

export const ScreenErrorView = memo(function ScreenErrorView({
  nav,
  palette = NEUTRAL_PALETTE,
  detail,
  canGoBack = true,
  onRetry,
  onBack,
}: ScreenErrorViewProps) {
  const { t } = useTranslation("common");
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      <View style={[styles.center, nav ? styles.besideNav : null]}>
        <GlassSurface radius={TV_STAGE.hero.radius} tone="strong" style={styles.panel} elevated>
          <BrandMark size={136} crying />
          <Text style={styles.title}>{t("tvScreenErrorTitle")}</Text>
          <Text style={styles.message}>{t("tvScreenErrorText")}</Text>
          <View style={styles.actions}>
            <PillButton variant="primary" icon="refresh" label={t("retry")} focusKey="screenError:retry" onPress={onRetry} />
          </View>
          {detail ? (
            <Text style={styles.detail} numberOfLines={2}>{detail.slice(0, 160)}</Text>
          ) : null}
        </GlassSurface>
      </View>
      {canGoBack ? (
        <FocusGroup focusKey="screenError:top" style={[styles.backBar, { left: nav ? TV_STAGE.contentLeft : TV_STAGE.safe.x }]}>
          <BackButton focusKey="screenError:back" onPress={onBack} />
        </FocusGroup>
      ) : null}
      {nav ? <NavRail {...nav} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  besideNav: { paddingLeft: TV_STAGE.contentLeft - TV_STAGE.safe.x },
  panel: { width: 1000, alignItems: "center", paddingHorizontal: 72, paddingTop: 56, paddingBottom: 48 },
  title: { ...text.heading, fontSize: 48, lineHeight: 56, textAlign: "center", marginTop: 26 },
  message: { ...fonts.regular, fontSize: 30, lineHeight: 42, color: colors.textSecondary, textAlign: "center", marginTop: 14 },
  actions: { flexDirection: "row", gap: 22, marginTop: 40 },
  // En haut à gauche du contenu, sur toute sa largeur : HAUT depuis le panneau y monte.
  backBar: {
    position: "absolute",
    top: 0,
    right: 0,
    height: BACK_TOP + BACK_BUTTON_SIZE,
    paddingTop: BACK_TOP,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detail: {
    ...fonts.medium,
    alignSelf: "stretch",
    marginTop: 40,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: white(0.05),
    fontSize: 22,
    lineHeight: 30,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
