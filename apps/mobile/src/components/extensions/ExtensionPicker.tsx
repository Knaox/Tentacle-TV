import { useEffect } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { RAIL_WIDTH } from "@/components/navigation/TabRail";
import type { ExtensionPluginGroup } from "@/hooks/useExtensionSections";
import { FONT_FAMILY, RADIUS, SHEET_MAX_WIDTH, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  plugins: ExtensionPluginGroup[];
  activePluginId: string | null;
  /** Rail iPad paysage : le menu s'ouvre à côté du rail, pas au-dessus d'une barre basse. */
  sideNav: boolean;
  /** Un plugin (sa dernière page vue) — ou, si `sectionId`, cette page précise. */
  onSelect: (plugin: ExtensionPluginGroup, sectionId?: string) => void;
  onClose: () => void;
}

/**
 * Le sous-menu des extensions, ouvert par l'onglet quand PLUSIEURS plugins
 * publient des pages : un plugin par ligne (son icône, son nom, ses pages), le
 * courant coché ; ses pages en pastilles pour y aller directement. Posé
 * au-dessus de la barre (ou à côté du rail), sur un voile qui le referme.
 *
 * Avec un seul plugin, il n'existe pas : l'onglet porte le nom du plugin et y
 * mène tout droit (`resolveExtensionTab`).
 */
export function ExtensionPicker({ plugins, activePluginId, sideNav, onSelect, onClose }: Props) {
  const { t } = useTranslation("nav");
  const { t: tc } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const tabBarH = useGlassTabBarHeight();

  // Retour matériel (Android) : il referme le menu avant de quitter l'onglet.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  // Au-dessus de la barre, centré et borné sur tablette ; à côté du rail en paysage.
  const { width: windowW } = useWindowDimensions();
  const cardW = Math.min(windowW - 2 * spacing.md, SHEET_MAX_WIDTH);
  const placement = sideNav
    ? { left: RAIL_WIDTH + spacing.md, bottom: spacing.xl, width: 360 }
    : { left: (windowW - cardW) / 2, width: cardW, bottom: tabBarH + spacing.sm };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, st.scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tc("close")} />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(220)}
        exiting={FadeOutDown.duration(140)}
        style={[st.card, placement]}
        accessibilityViewIsModal
      >
        {/* Verre épais : le menu se lit par-dessus n'importe quelle affiche. */}
        <GlassSurface tier="sheet" tint="strong" intensity={60} radius={RADIUS.xl} style={st.glass}>
          <Text style={st.heading} accessibilityRole="header">{t("extensions")}</Text>
          <ScrollView style={st.list} contentContainerStyle={st.listContent} bounces={false}>
            {plugins.map((plugin) => {
              const active = plugin.pluginId === activePluginId;
              return (
                <View key={plugin.pluginId} style={[st.row, active && st.rowActive]}>
                  <Pressable
                    onPress={() => onSelect(plugin)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={plugin.name}
                    style={({ pressed }) => [st.rowMain, pressed && st.pressed]}
                  >
                    <View style={[st.iconWell, active && st.iconWellActive]}>
                      <Feather name={plugin.icon} size={18} color={active ? theme.colors.brand.light : theme.colors.text.secondary} />
                    </View>
                    <View style={st.rowText}>
                      <Text style={[st.name, active && st.nameActive]} numberOfLines={1}>{plugin.name}</Text>
                      {/* Une page unique au nom du plugin n'a rien à ajouter. */}
                      {!(plugin.sections.length === 1 && plugin.sections[0].label === plugin.name) && (
                        <Text style={st.pages} numberOfLines={1}>
                          {plugin.sections.map((s) => s.label).join(" · ")}
                        </Text>
                      )}
                    </View>
                    {active && <Feather name="check" size={18} color={theme.colors.brand.light} />}
                  </Pressable>
                  {plugin.sections.length > 1 && (
                    <View style={st.chips}>
                      {plugin.sections.map((section) => (
                        <Pressable
                          key={section.id}
                          onPress={() => onSelect(plugin, section.id)}
                          hitSlop={5}
                          accessibilityRole="menuitem"
                          accessibilityLabel={`${plugin.name} · ${section.label}`}
                          style={({ pressed }) => [st.chip, pressed && st.pressed]}
                        >
                          <Feather name={section.icon} size={13} color={theme.colors.text.tertiary} />
                          <Text style={st.chipTxt} numberOfLines={1}>{section.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrim: { backgroundColor: t.colors.overlay.scrim },
    card: {
      position: "absolute" as const,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: t.isDark ? 0.5 : 0.16,
      shadowRadius: 28,
      elevation: 16,
    },
    glass: { paddingTop: spacing.md, paddingBottom: spacing.sm },
    heading: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: "uppercase" as const,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
    },
    list: { maxHeight: 420 },
    listContent: { paddingHorizontal: spacing.sm, gap: 4 },
    row: { borderRadius: RADIUS.lg, paddingBottom: 2 },
    rowActive: { backgroundColor: t.colors.brand.soft },
    rowMain: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      minHeight: 56,
      paddingHorizontal: spacing.sm,
      borderRadius: RADIUS.lg,
    },
    pressed: { opacity: 0.7 },
    iconWell: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.fill.soft,
    },
    iconWellActive: { backgroundColor: t.colors.brand.glow },
    rowText: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    nameActive: { color: t.colors.brand.light },
    pages: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    chips: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 6,
      paddingLeft: 56,
      paddingRight: spacing.sm,
      paddingBottom: spacing.sm,
    },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    chipTxt: { fontSize: 12.5, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
