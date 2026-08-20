import { StyleSheet } from "react-native";
import { Colors, Radius, Typography, brandAlpha } from "../theme/colors";
import { Bouton } from "../theme/boutons";

/**
 * Styles de l'écran de mention légale (CGU), 10-foot UI + parité avec le client
 * web (`apps/web/src/pages/Disclaimer.tsx`) :
 * - colonne flex (pas de scroll global) : en-tête + corps qui se rétrécit
 *   (`flexShrink`) + footer checkbox/boutons TOUJOURS visibles et focusables —
 *   indispensable sur une dalle TV de ~540dp de haut où un scroll global
 *   piloté au focus rendrait les boutons inatteignables ;
 * - carte centrée resserrée (≈ max-w-lg web) → longueur de ligne maîtrisée ;
 * - boutons empilés pleine largeur, tokens CTA du design system (primaire
 *   blanc / ghost translucide) ; case à cocher calquée sur le web.
 */
export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    paddingVertical: 24,
  },
  // Carte centrée — borne la largeur de ligne (≈ 512px max-w-lg du web).
  card: {
    width: "100%",
    maxWidth: 540,
    flex: 1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 6,
  },
  appName: {
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginTop: 4,
  },
  langRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
  },
  langButton: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    ...Bouton.moyen,
    borderWidth: 1,
    borderColor: "transparent",
  },
  langButtonActive: {
    backgroundColor: brandAlpha(0.15),
    borderColor: brandAlpha(0.3),
  },
  langText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  langTextActive: {
    color: Colors.accentPurple,
  },
  title: {
    ...Typography.pageTitle,
    fontSize: 19,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  heading: {
    fontSize: 15,
    color: Colors.accentPurple,
    textAlign: "center",
    marginBottom: 8,
  },
  // Corps : occupe tout l'espace entre en-tête et footer (scroll interne au pire).
  glassContainer: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    padding: 14,
    marginBottom: 12,
  },
  body: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  // ── Checkbox (parité web : case 26dp, border-2, rounded-md) ──
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: brandAlpha(0.18),
    borderColor: brandAlpha(0.55),
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    flex: 1,
  },
  // ── Boutons empilés pleine largeur (tokens CTA design system) ──
  buttonsCol: {
    marginTop: 10,
  },
  acceptButton: {
    width: "100%",
    minHeight: 44,
    borderRadius: Radius.buttonLarge,
    backgroundColor: Colors.ctaPrimaryBg,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 9,
    // Ombre violette portée — parité avec le boxShadow web.
    shadowColor: Colors.accentPurple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 8,
  },
  acceptButtonDisabled: {
    opacity: 0.4,
  },
  acceptText: {
    ...Typography.buttonLarge,
    color: Colors.ctaPrimaryFg,
    textAlign: "center",
  },
  declineButton: {
    width: "100%",
    minHeight: 40,
    borderRadius: Radius.buttonLarge,
    backgroundColor: Colors.ctaGhostBg,
    borderWidth: 1,
    borderColor: Colors.ctaGhostBorder,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 8,
  },
  declineText: {
    ...Typography.buttonMedium,
    color: Colors.textMuted,
    textAlign: "center",
  },
});
