import { useEffect, useMemo, useState } from "react";
import { Tabs } from "expo-router";
import { Platform, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMobilePluginNavItems, usePrefetchPluginBundles } from "@/hooks/useActivePlugins";
import { PersistentHeader } from "@/components/PersistentHeader";
import { TabRail, RAIL_WIDTH } from "@/components/navigation/TabRail";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { RailMenu, type RailMenuItem } from "@/components/navigation/RailMenu";
import { useResponsive, useTheme, RailWidthContext } from "@/theme";

// Mapping des icônes unicode du plugin.json → noms Feather
const ICON_MAP: Record<string, string> = {
  "✦": "compass",
  "☰": "list",
  "▥": "bar-chart-2",
};

function resolveIcon(icon: string | undefined, fallback: string): string {
  if (!icon) return fallback;
  return ICON_MAP[icon] ?? icon;
}

export default function TabsLayout() {
  const { t } = useTranslation("nav");
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = screenW < 380;
  const navItems = useMobilePluginNavItems();
  usePrefetchPluginBundles();
  const first = navItems[0];
  const second = navItems[1];

  // Nav : portrait (et iPhone) = barre basse ; iPad PAYSAGE = rail gauche fin
  // + menu déroulant (RailMenu). La largeur du rail est publiée via contexte
  // pour que hero/grilles se calent sur la largeur de contenu réelle.
  const { isTablet, isLandscape } = useResponsive();
  const sideNav = isTablet && isLandscape;
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (!sideNav) setMenuOpen(false); }, [sideNav]);

  const menuItems = useMemo<RailMenuItem[]>(() => [
    { href: "/", icon: "home", label: t("home") },
    { href: "/libraries", icon: "film", label: t("library") },
    ...(first ? [{ href: "/plugins" as const, icon: resolveIcon(first.icon, "compass"), label: first.label }] : []),
    ...(second ? [{ href: "/plugin-extra" as const, icon: resolveIcon(second.icon, "list"), label: second.label }] : []),
    { href: "/profile", icon: "user", label: t("profile") },
  ], [t, first, second]);

  return (
    <RailWidthContext.Provider value={sideNav ? RAIL_WIDTH : 0}>
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
      {/* Tab 1: Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarAccessibilityLabel: t("home"),
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />

      {/* Tab 2: Libraries */}
      <Tabs.Screen
        name="libraries"
        options={{
          title: t("library"),
          tabBarAccessibilityLabel: t("library"),
          tabBarIcon: ({ color, size }) => <Feather name="film" size={size} color={color} />,
        }}
      />

      {/* Tab 3: Plugin navItem[0] (e.g. Discover) */}
      <Tabs.Screen
        name="plugins"
        options={{
          title: first?.label ?? "Plugins",
          tabBarAccessibilityLabel: first?.label ?? "Plugins",
          href: first ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={resolveIcon(first?.icon, "compass") as never} size={size} color={color} />
          ),
        }}
      />

      {/* Tab 4: Plugin navItem[1] (e.g. Requests) */}
      <Tabs.Screen
        name="plugin-extra"
        options={{
          title: second?.label ?? "Plugins",
          tabBarAccessibilityLabel: second?.label ?? "Plugins",
          href: second ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={resolveIcon(second?.icon, "list") as never} size={size} color={color} />
          ),
        }}
      />

      {/* Tab 5: Profile */}
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
    </RailWidthContext.Provider>
  );
}
