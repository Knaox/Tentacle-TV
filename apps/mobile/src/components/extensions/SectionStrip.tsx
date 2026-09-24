import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, motion, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import type { ExtensionSection } from "@/hooks/useExtensionSections";

/** Largeur du fondu qui efface les pilules sous le nom du plugin — un palier
 *  opaque d'abord, sinon un libellé clair reste lisible à travers. */
const FADE_W = 40;

interface Props {
  /** Les pages d'UN plugin. */
  sections: ExtensionSection[];
  activeId: string | undefined;
  /**
   * Le nom du plugin, quand l'onglet ne le porte pas (plusieurs plugins :
   * l'onglet dit « Extensions »). Seul, le plugin nomme déjà l'onglet.
   */
  pluginName?: string;
  onSelect: (id: string) => void;
}

/**
 * Le bandeau des pages d'un plugin, sous l'en-tête : une pilule par page,
 * précédée du nom du plugin quand l'onglet ne le dit pas. Surface plate (le
 * contenu ne défile pas dessous, un verre n'aurait rien à réfracter). Cibles
 * de 44 pt, 8 pt entre elles.
 */
export function SectionStrip({ sections, activeId, pluginName, onSelect }: Props) {
  const { t } = useTranslation("nav");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, number>>({});
  const named = pluginName !== undefined;

  // La pilule active revient dans le champ (lien profond vers une section
  // hors écran, bandeau qui déborde sur téléphone).
  useEffect(() => {
    if (!activeId) return;
    const x = layouts.current[activeId];
    if (x === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - (named ? FADE_W : 0)), animated: !motion.isReducedMotion() });
  }, [activeId, named]);

  return (
    <View style={st.wrap}>
      {/* Le nom reste FIXE à gauche, hors du défilement — le bandeau qui se
          cale sur la page active le cacherait sinon. */}
      {named && (
        <View style={st.pluginLabel} accessibilityRole="header">
          <Feather name="package" size={13} color={theme.colors.text.tertiary} />
          <Text style={st.pluginLabelTxt} numberOfLines={1}>{pluginName}</Text>
        </View>
      )}
      <View style={st.scroll}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[st.content, !named && st.contentBare]}
        accessibilityRole="tablist"
        accessibilityLabel={t("extensionSections")}
      >
        {sections.map((section) => {
          const active = section.id === activeId;
          const tint = active ? theme.colors.brand.light : theme.colors.text.tertiary;
          return (
            <Pressable
              key={section.id}
              onPress={() => onSelect(section.id)}
              onLayout={(e) => { layouts.current[section.id] = e.nativeEvent.layout.x; }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={named ? `${pluginName} · ${section.label}` : section.label}
              style={({ pressed }) => [st.pill, active && st.pillActive, pressed && !active && st.pressed]}
            >
              <Feather name={section.icon} size={15} color={tint} />
              <Text style={[st.label, active && st.labelActive]} numberOfLines={1}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Les pilules défilées s'effacent en fondu sous le nom du plugin au
          lieu d'être coupées net à son bord. */}
      {named && (
        <LinearGradient
          pointerEvents="none"
          colors={[theme.colors.surface.s0, theme.colors.surface.s0, withAlpha(theme.colors.surface.s0, 0, "transparent")]}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={st.fade}
        />
      )}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: t.colors.surface.s0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    scroll: { flex: 1 },
    content: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      paddingLeft: FADE_W,
      paddingRight: spacing.screenPadding,
      paddingVertical: spacing.xs,
    },
    // Sans nom devant : les pilules défilent jusqu'au bord de l'écran.
    contentBare: { paddingLeft: spacing.screenPadding },
    fade: { position: "absolute" as const, left: 0, top: 0, bottom: 0, width: FADE_W },
    pill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    pillActive: {
      backgroundColor: t.colors.brand.soft,
      borderColor: t.colors.brand.glow,
    },
    pressed: { opacity: 0.85 },
    label: {
      fontSize: 13,
      fontFamily: FONT_FAMILY.medium,
      color: t.colors.text.tertiary,
      letterSpacing: 0.1,
    },
    labelActive: {
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.brand.light,
    },
    pluginLabel: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      maxWidth: 160,
      marginLeft: spacing.screenPadding,
    },
    pluginLabelTxt: {
      fontSize: 11,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
      letterSpacing: 0.8,
      textTransform: "uppercase" as const,
    },
  });
