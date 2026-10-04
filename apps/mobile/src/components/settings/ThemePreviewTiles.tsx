import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  buildDarkPalette, buildLightPalette, ctlGradient, spacing, typography, FONT_FAMILY,
  useTheme, useThemedStyles, type AppTheme, type ThemeMode,
} from "@/theme";
import { THEME_MODE_LABEL_KEYS } from "./themeModeLabels";

/** Les vraies palettes de l'app : l'aperçu montre ce qu'on obtiendra, pas une idée. */
const LIGHT = buildLightPalette();
const DARK = buildDarkPalette();
type Palette = typeof LIGHT;

const MODES: readonly ThemeMode[] = ["light", "dark", "auto"];
const PREVIEW_HEIGHT = 72;
const RADIUS = 12;

/**
 * Le thème par l'image, comme l'aperçu du verre des réglages de l'Apple TV :
 * trois vignettes — une page miniature de l'app dans chaque thème, « Auto »
 * coupée en deux — et le nom dessous. La vignette retenue est cerclée du
 * violet de la marque et porte la coche. Toute la vignette est la cible.
 */
export const ThemePreviewTiles = memo(function ThemePreviewTiles({ value, onChange }: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.row} accessibilityRole="radiogroup" accessibilityLabel={t("theme")}>
      {MODES.map((mode) => (
        <Tile key={mode} mode={mode} label={t(THEME_MODE_LABEL_KEYS[mode])} active={mode === value} onPress={() => onChange(mode)} />
      ))}
    </View>
  );
});

function Tile({ mode, label, active, onPress }: { mode: ThemeMode; label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, checked: active }}
      style={({ pressed }) => [st.tile, pressed && st.pressed]}
    >
      <View style={[st.frame, active ? st.frameActive : st.frameIdle]}>
        {mode === "auto" ? (
          <View style={st.split}>
            <View style={st.half}><MiniPage palette={LIGHT} half="left" /></View>
            <View style={[st.half, st.halfRight]}><MiniPage palette={DARK} half="right" /></View>
          </View>
        ) : (
          <MiniPage palette={mode === "light" ? LIGHT : DARK} />
        )}
      </View>
      <View style={st.caption}>
        {active ? <Feather name="check-circle" size={14} color={theme.colors.brand.violet} /> : null}
        <Text style={[st.label, active && st.labelActive]} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Une page miniature : le fond, une carte, deux lignes de texte, le bouton
 * de la marque. `half` : « Auto » montre la moitié gauche de la page claire
 * et la moitié droite de la sombre — UNE page, coupée en deux.
 */
function MiniPage({ palette, half }: { palette: Palette; half?: "left" | "right" }) {
  const gradient = ctlGradient(palette.brand);
  const frame = half ? [mini.wide, half === "right" && mini.wideRight] : StyleSheet.absoluteFill;
  return (
    <View style={[frame, { backgroundColor: palette.surface.s0 }]}>
      <View style={mini.page}>
        <View style={[mini.card, { backgroundColor: palette.surface.s2 }]} />
        <View style={[mini.line, { backgroundColor: palette.text.primary, width: "58%" }]} />
        <View style={[mini.line, mini.lineShort, { backgroundColor: palette.text.tertiary }]} />
        <LinearGradient colors={gradient.colors} locations={gradient.locations} start={gradient.start} end={gradient.end} style={mini.cta} />
      </View>
    </View>
  );
}

const mini = StyleSheet.create({
  wide: { position: "absolute", top: 0, bottom: 0, left: 0, width: "200%" },
  wideRight: { left: "-100%" },
  page: { width: "100%", height: "100%", padding: 8, gap: 5 },
  card: { height: 22, borderRadius: 5 },
  line: { height: 4, borderRadius: 2, opacity: 0.85 },
  lineShort: { width: "38%", opacity: 0.7 },
  cta: { position: "absolute", right: 8, bottom: 8, width: 26, height: 10, borderRadius: 5 },
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    // Bornés : sur la colonne large de l'iPad, une vignette étirée ne ressemble plus à une page.
    row: { flexDirection: "row", gap: spacing.sm, maxWidth: 440 },
    tile: { flex: 1, gap: spacing.xs + 2 },
    pressed: { transform: [{ scale: 0.97 }] },
    frame: { height: PREVIEW_HEIGHT, borderRadius: RADIUS, overflow: "hidden" },
    frameIdle: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.strong },
    frameActive: { borderWidth: 2, borderColor: t.colors.brand.violet },
    split: { flex: 1, flexDirection: "row" },
    half: { flex: 1, overflow: "hidden" },
    halfRight: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.colors.border.strong },
    caption: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 18 },
    label: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    labelActive: { fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  });
