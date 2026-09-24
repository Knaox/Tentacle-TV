import { useEffect, useMemo, useState } from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { Sparkles } from "lucide-react-native";
import { usePrefetchPluginBundles } from "@/hooks/useActivePlugins";
import { ExtensionPicker } from "@/components/extensions/ExtensionPicker";
import { useExtensionNav } from "@/components/extensions/useExtensionNav";
import { PersistentHeader } from "@/components/PersistentHeader";
import { TabRail, RAIL_WIDTH } from "@/components/navigation/TabRail";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { RailMenu, type RailMenuItem } from "@/components/navigation/RailMenu";
import { ScrollChromeProvider } from "@/components/navigation/scrollChrome";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useResponsive, useTheme, RailWidthContext } from "@/theme";

/**
 * La barre basse est FIXE : Accueil · Pour vous · Bibliothèque · extensions ·
 * Profil.
 * Toutes les pages d'extension vivent dans le seul onglet `extensions` : une
 * extension de plus n'ajoute jamais d'onglet. Un seul plugin : l'onglet porte
 * son nom (« Vigie ») et y mène ; plusieurs : il ouvre le sous-menu des
 * plugins. Sans aucune page d'extension, cet onglet se masque.
 *
 * Hors ligne, il n'en reste que deux : l'Accueil devient « Sur cet appareil »
 * (le catalogue local) et le Profil se réduit ; Pour vous, Bibliothèque et
 * extensions n'ont rien à montrer sans serveur.
 */
export default function TabsLayout() {
  const { t } = useTranslation("nav");
  const { t: to } = useTranslation("offline");
  const theme = useTheme();
  const extNav = useExtensionNav();
  const { ext } = extNav;
  const offline = useOfflineMode();
  usePrefetchPluginBundles();

  // Nav : portrait (et iPhone) = barre basse ; iPad PAYSAGE = rail gauche fin
  // + menu déroulant (RailMenu). La largeur du rail est publiée via contexte
  // pour que hero/grilles se calent sur la largeur de contenu réelle.
  const { isTablet, isLandscape } = useResponsive();
  const sideNav = isTablet && isLandscape;
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (!sideNav) setMenuOpen(false); }, [sideNav]);

  const homeLabel = offline ? to("tabOnDevice") : t("home");
  const homeIcon: keyof typeof Feather.glyphMap = offline ? "smartphone" : "home";

  const menuItems = useMemo<RailMenuItem[]>(() => [
    { href: "/", icon: homeIcon, label: homeLabel },
    ...(offline ? [] : [
      { href: "/for-you" as const, icon: "star", iconNode: (color: string) => <Sparkles size={20} color={color} />, label: t("forYou") },
      { href: "/libraries" as const, icon: "film", label: t("library") },
      // Un plugin : une entrée ; plusieurs : une par plugin.
      ...extNav.railItems,
    ]),
    { href: "/profile", icon: "user", label: t("profile") },
  ], [t, offline, homeIcon, homeLabel, extNav.railItems]);

  return (
    <RailWidthContext.Provider value={sideNav ? RAIL_WIDTH : 0}>
    <ScrollChromeProvider>
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
    <Tabs
      tabBar={sideNav
        ? (props) => <TabRail {...props} onOpenMenu={() => setMenuOpen(true)} />
        : (props) => <GlassTabBar {...props} />}
      // Les barres sont maison (GlassTabBar, TabRail) : elles ne lisent aucune
      // option `tabBar*` de react-navigation — seule la position compte.
      screenOptions={{
        headerShown: false,
        // iPad paysage : rail gauche custom ; sinon barre basse.
        tabBarPosition: sideNav ? "left" : "bottom",
      }}
    >
      {/* Accueil — ou « Sur cet appareil » hors ligne */}
      <Tabs.Screen
        name="index"
        options={{
          title: homeLabel,
          tabBarAccessibilityLabel: homeLabel,
          tabBarIcon: ({ color, size }) => <Feather name={homeIcon} size={size} color={color} />,
        }}
      />

      {/* Pour vous — la page de recommandations */}
      <Tabs.Screen
        name="for-you"
        options={{
          title: t("forYou"),
          tabBarAccessibilityLabel: t("forYou"),
          href: offline ? null : undefined,
          tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
        }}
      />

      {/* Bibliothèque */}
      <Tabs.Screen
        name="libraries"
        options={{
          title: t("library"),
          tabBarAccessibilityLabel: t("library"),
          href: offline ? null : undefined,
          tabBarIcon: ({ color, size }) => <Feather name="film" size={size} color={color} />,
        }}
      />

      {/* Extensions — un plugin : son nom, et l'appui y mène ; plusieurs :
          l'appui ouvre le sous-menu (useExtensionNav). `href: null` masque
          l'onglet quand aucune page n'est publiée. */}
      <Tabs.Screen
        name="extensions"
        listeners={extNav.listeners}
        options={{
          title: extNav.label,
          tabBarAccessibilityLabel: extNav.label,
          href: ext.visible && !offline ? undefined : null,
          tabBarIcon: ({ color, size }) => <Feather name={extNav.icon} size={size} color={color} />,
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
    {extNav.pickerOpen && ext.multiPlugin && !offline && (
      <ExtensionPicker
        plugins={ext.plugins}
        activePluginId={extNav.activePluginId}
        sideNav={sideNav}
        onSelect={extNav.openPlugin}
        onClose={extNav.closePicker}
      />
    )}
    {sideNav && <RailMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />}
    </View>
    </ScrollChromeProvider>
    </RailWidthContext.Provider>
  );
}
