import { useEffect, useMemo, useState } from "react";
import { Tabs } from "expo-router";
import { Platform, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Sparkles } from "lucide-react-native";
import { usePrefetchPluginBundles } from "@/hooks/useActivePlugins";
import { useExtensionTab } from "@/hooks/useExtensionSections";
import { PersistentHeader } from "@/components/PersistentHeader";
import { TabRail, RAIL_WIDTH } from "@/components/navigation/TabRail";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { RailMenu, type RailMenuItem } from "@/components/navigation/RailMenu";
import { ScrollChromeProvider } from "@/components/navigation/scrollChrome";
import { useResponsive, useTheme, RailWidthContext } from "@/theme";

/**
 * La barre basse est FIXE : Accueil · Pour vous · Bibliothèque · extensions ·
 * Profil.
 * Toutes les pages d'extension vivent dans le seul onglet `extensions` (en
 * sections) : une extension de plus n'ajoute jamais d'onglet. Sans aucune
 * page d'extension, cet onglet se masque.
 */
export default function TabsLayout() {
  const { t } = useTranslation("nav");
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = screenW < 380;
  const ext = useExtensionTab();
  usePrefetchPluginBundles();

  // Nav : portrait (et iPhone) = barre basse ; iPad PAYSAGE = rail gauche fin
  // + menu déroulant (RailMenu). La largeur du rail est publiée via contexte
  // pour que hero/grilles se calent sur la largeur de contenu réelle.
  const { isTablet, isLandscape } = useResponsive();
  const sideNav = isTablet && isLandscape;
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (!sideNav) setMenuOpen(false); }, [sideNav]);

  const menuItems = useMemo<RailMenuItem[]>(() => [
    { href: "/", icon: "home", label: t("home") },
    { href: "/for-you", icon: "star", iconNode: (color) => <Sparkles size={20} color={color} />, label: t("forYou") },
    { href: "/libraries", icon: "film", label: t("library") },
    ...(ext.visible ? [{ href: "/extensions" as const, icon: ext.icon, label: ext.label }] : []),
    { href: "/profile", icon: "user", label: t("profile") },
  ], [t, ext.visible, ext.icon, ext.label]);

  return (
    <RailWidthContext.Provider value={sideNav ? RAIL_WIDTH : 0}>
    <ScrollChromeProvider>
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
    <Tabs
      tabBar={sideNav
        ? (props) => <TabRail {...props} onOpenMenu={() => setMenuOpen(true)} />
        : (props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // iPad paysage : rail gauche custom ; sinon barre basse inchangée.
        tabBarPosition: sideNav ? "left" : "bottom",
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border.subtle,
          borderTopWidth: 0.5,
          height: 60 + Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0),
          paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0),
          paddingTop: isCompact ? 4 : 8,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.brand.violet,
        tabBarInactiveTintColor: theme.colors.text.quaternary,
        tabBarLabelStyle: { fontSize: isCompact ? 9 : 11, fontWeight: "600" },
        tabBarAllowFontScaling: false,
      }}
    >
      {/* Accueil */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarAccessibilityLabel: t("home"),
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />

      {/* Pour vous — la page de recommandations */}
      <Tabs.Screen
        name="for-you"
        options={{
          title: t("forYou"),
          tabBarAccessibilityLabel: t("forYou"),
          tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
        }}
      />

      {/* Bibliothèque */}
      <Tabs.Screen
        name="libraries"
        options={{
          title: t("library"),
          tabBarAccessibilityLabel: t("library"),
          tabBarIcon: ({ color, size }) => <Feather name="film" size={size} color={color} />,
        }}
      />

      {/* Extensions — libellé et icône décidés par les plugins actifs ;
          `href: null` masque l'onglet quand aucune page n'est publiée. */}
      <Tabs.Screen
        name="extensions"
        options={{
          title: ext.label,
          tabBarAccessibilityLabel: ext.label,
          href: ext.visible ? undefined : null,
          tabBarIcon: ({ color, size }) => <Feather name={ext.icon} size={size} color={color} />,
        }}
      />

      {/* Profil */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarAccessibilityLabel: t("profile"),
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
    {/* Header Liquid Glass flottant : APRÈS les Tabs → overlay au-dessus du
        contenu (qui défile dessous et se réfracte). Écrans compensés via
        useHeaderHeight() en paddingTop. */}
    <PersistentHeader />
    {sideNav && <RailMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />}
    </View>
    </ScrollChromeProvider>
    </RailWidthContext.Provider>
  );
}
