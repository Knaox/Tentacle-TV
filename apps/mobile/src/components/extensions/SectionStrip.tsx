import { Fragment, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, motion, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { shortPluginName, type ExtensionSection } from "@/hooks/useExtensionSections";

/** Largeur du fondu qui efface les pilules sous le nom du plugin — un palier
 *  opaque d'abord, sinon un libellé clair reste lisible à travers. */
const FADE_W = 40;

interface Props {
  sections: ExtensionSection[];
  activeId: string | undefined;
  /** Plusieurs plugins : un séparateur entre les groupes, le nom du plugin dans le libellé lu. */
  multiPlugin: boolean;
  onSelect: (id: string) => void;
}

/**
 * Le bandeau de sections de l'onglet des extensions : une pilule par page,
 * sous l'en-tête, précédée du NOM du plugin qui les publie — c'est lui qui
 * dit d'où viennent ces pages, l'onglet ne portant qu'un nom générique.
 * Surface plate (le contenu ne défile pas dessous, un verre n'aurait rien à
 * réfracter). Cibles de 44 pt, 8 pt entre elles.
 */
export function SectionStrip({ sections, activeId, multiPlugin, onSelect }: Props) {
  const { t } = useTranslation("nav");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, number>>({});

  // La pilule active revient dans le champ (lien profond vers une section
  // hors écran, bandeau qui déborde sur téléphone).
  useEffect(() => {
    if (!activeId) return;
    const x = layouts.current[activeId];
    if (x === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - FADE_W), animated: !motion.isReducedMotion() });
  }, [activeId]);

  const pluginLabel = (name: string) => (
    <View style={st.pluginLabel} accessibilityRole="header">
      <Feather name="package" size={13} color={theme.colors.text.tertiary} />
      <Text style={st.pluginLabelTxt} numberOfLines={1}>{shortPluginName(name)}</Text>
    </View>
  );

  return (
    <View style={st.wrap}>
      {/* Un seul plugin : son nom reste FIXE à gauche, hors du défilement — le
          bandeau qui se cale sur la section active le cacherait sinon. */}
      {!multiPlugin && sections[0] && pluginLabel(sections[0].pluginName)}
      <View style={st.scroll}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.content}
        accessibilityRole="tablist"
        accessibilityLabel={t("extensionSections")}
      >
        {sections.map((section, i) => {
          const active = section.id === activeId;
          const groupStart = multiPlugin && (i === 0 || sections[i - 1].pluginId !== section.pluginId);
          const tint = active ? theme.colors.brand.light : theme.colors.text.tertiary;
          return (
            <Fragment key={section.id}>
              {groupStart && pluginLabel(section.pluginName)}
              <Pressable
                onPress={() => onSelect(section.id)}
                onLayout={(e) => { layouts.current[section.id] = e.nativeEvent.layout.x; }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={multiPlugin ? `${section.pluginName} · ${section.label}` : section.label}
                style={({ pressed }) => [st.pill, active && st.pillActive, pressed && !active && st.pressed]}
              >
                <Feather name={section.icon} size={15} color={tint} />
                <Text style={[st.label, active && st.labelActive]} numberOfLines={1}>
                  {section.label}
                </Text>
              </Pressable>
            </Fragment>
          );
        })}
      </ScrollView>
      {/* Les pilules défilées s'effacent en fondu sous le nom du plugin au
          lieu d'être coupées net à son bord. */}
      <LinearGradient
        pointerEvents="none"
        colors={[theme.colors.surface.s0, theme.colors.surface.s0, withAlpha(theme.colors.surface.s0, 0, "transparent")]}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={st.fade}
      />
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingLeft: spacing.screenPadding,
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
    },
    pluginLabelTxt: {
      fontSize: 11,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
      letterSpacing: 0.8,
      textTransform: "uppercase" as const,
    },
  });
