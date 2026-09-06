import { StyleSheet } from "react-native";
import { FONT_FAMILY, withAlpha, type AppTheme } from "@/theme";

/** La vignette d'une ligne d'épisode, en ligne comme hors ligne. */
export const THUMB_W = 110;
export const THUMB_H = 62;

/**
 * Le dessin d'une ligne d'épisode (fond, vignette, piste de progression,
 * titre, méta, synopsis, rond « vu »), partagé par la liste en ligne
 * (`EpisodeItemRow`) et sa jumelle hors ligne (`OfflineEpisodeRow`).
 */
export const makeEpisodeRowStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", backgroundColor: t.colors.fill.faint, borderRadius: 10, overflow: "hidden", minHeight: THUMB_H },
    main: { flexDirection: "row", flex: 1 },
    thumb: { width: THUMB_W, height: THUMB_H, alignSelf: "center", backgroundColor: t.colors.surface.s2, borderRadius: 6, overflow: "hidden" },
    progressTrack: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: t.colors.fill.strong },
    body: { flex: 1, padding: 10, justifyContent: "center" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.brand.accent },
    title: { flex: 1, color: t.colors.text.primary, fontSize: 13, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    current: { fontSize: 10, fontFamily: FONT_FAMILY.bold, letterSpacing: 0.6, textTransform: "uppercase" },
    runtime: { color: t.colors.text.quaternary, fontSize: 11 },
    overview: { color: t.colors.text.quaternary, fontSize: 11, marginTop: 4, lineHeight: 15 },
    toggle: { paddingRight: 12, paddingLeft: 4 },
    ring: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    ringPlayed: {
      backgroundColor: withAlpha(t.colors.brand.accent, 0.15, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.accent, 0.45, t.colors.brand.glow),
    },
  });
