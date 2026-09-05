import { Fragment, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, motion, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { ExtensionSection } from "@/hooks/useExtensionSections";

interface Props {
  sections: ExtensionSection[];
  activeId: string | undefined;
  /** Plusieurs plugins : un séparateur entre les groupes, le nom du plugin dans le libellé lu. */
  multiPlugin: boolean;
  onSelect: (id: string) => void;
}

/**
 * Le bandeau de sections de l'onglet des extensions : une pilule par page,
 * sous l'en-tête. Surface plate (le contenu ne défile pas dessous, un verre
 * n'aurait rien à réfracter). Cibles de 44 pt, 8 pt entre elles.
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
    scrollRef.current?.scrollTo({
      x: Math.max(0, x - spacing.screenPadding),
      animated: !motion.isReducedMotion(),
    });
  }, [activeId]);

  return (
    <View style={st.wrap}>
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
          const groupBreak = multiPlugin && i > 0 && sections[i - 1].pluginId !== section.pluginId;
          const tint = active ? theme.colors.brand.light : theme.colors.text.tertiary;
          return (
            <Fragment key={section.id}>
              {groupBreak && <View style={st.divider} />}
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
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: t.colors.surface.s0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    content: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      paddingHorizontal: spacing.screenPadding,
      paddingVertical: spacing.xs,
    },
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
    divider: {
      width: 1,
      height: 20,
      marginHorizontal: 2,
      backgroundColor: t.colors.border.subtle,
    },
  });
