import { Tabs } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useMobilePluginNavItems, usePrefetchPluginBundles } from "@/hooks/useActivePlugins";
import { PersistentHeader } from "@/components/PersistentHeader";
import { colors } from "@/theme";

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
  const navItems = useMobilePluginNavItems();
  usePrefetchPluginBundles();
  const first = navItems[0];
  const second = navItems[1];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <PersistentHeader />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.borderAccent,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
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
    </View>
  );
}
