import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { Film, GalleryHorizontalEnd, House, Puzzle, Smartphone, Sparkles, User, type LucideIcon } from "lucide-react";
import { lucideIconFor, resolvePluginLabel } from "../../components/lucideIcon";
import { useOfflineMode } from "../../offline/useOfflineMode";

/**
 * Les onglets de l'app (`app/(tabs)/_layout.tsx`) : Accueil · Pour vous ·
 * Affiner · Bibliothèque · extensions · Profil — FIXES. Une extension de plus n'ajoute
 * jamais d'onglet : un seul plugin donne son nom à l'onglet et y mène ;
 * plusieurs ouvrent le sous-menu. Sans page d'extension, l'onglet se masque.
 * Hors ligne, il n'en reste que deux : l'accueil devient « Sur cet appareil ».
 */

export interface ExtensionPlugin {
  pluginId: string;
  name: string;
  /** La première page du plugin : l'onglet (ou le sous-menu) y mène. */
  path: string;
  /** Toutes ses pages web, dans l'ordre déclaré. */
  paths: string[];
  sections: Array<{ path: string; label: string; Icon: LucideIcon }>;
  Icon: LucideIcon;
}

export interface MirrorTab {
  key: "home" | "forYou" | "swipe" | "libraries" | "extensions" | "profile";
  label: string;
  /** L'icône (lucide, l'équivalent des noms Feather de l'app). */
  Icon: LucideIcon;
  /** Destination ; `null` pour l'onglet des extensions à plusieurs plugins (sous-menu). */
  path: string | null;
  active: boolean;
}

export function useExtensionPlugins(): ExtensionPlugin[] {
  const plugins = useActivePluginsMeta();
  const { i18n } = useTranslation();
  return useMemo(() => {
    const out: ExtensionPlugin[] = [];
    for (const plugin of plugins) {
      if (plugin.configEnabled !== true) continue;
      const navs = (plugin.navItems ?? []).filter((n) => !n.admin && n.platforms?.includes("web"));
      if (navs.length === 0) continue;
      const first = navs[0];
      out.push({
        pluginId: plugin.pluginId,
        // Le nom de l'onglet mobile (`tab` du manifeste), sinon celui du plugin.
        name: plugin.tab?.labels ? resolvePluginLabel(plugin.tab.labels, i18n.language) : plugin.name,
        path: first.path,
        paths: navs.map((n) => n.path),
        sections: navs.map((n) => ({
          path: n.path,
          label: resolvePluginLabel(n.labels ?? n.label, i18n.language),
          Icon: lucideIconFor(n.icon) ?? Puzzle,
        })),
        Icon: lucideIconFor(plugin.tab?.icon) ?? lucideIconFor(first.icon) ?? Puzzle,
      });
    }
    return out;
  }, [plugins, i18n.language]);
}

export function useMirrorTabs(): { tabs: MirrorTab[]; plugins: ExtensionPlugin[]; activePlugin: ExtensionPlugin | undefined } {
  const { t } = useTranslation("nav");
  const { t: to } = useTranslation("offline");
  const { pathname } = useLocation();
  const offline = useOfflineMode();
  const plugins = useExtensionPlugins();

  return useMemo(() => {
    const activePlugin = plugins.find((p) => p.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
    const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
    const tabs: MirrorTab[] = [
      {
        key: "home",
        label: offline ? to("tabOnDevice") : t("home"),
        Icon: offline ? Smartphone : House,
        path: "/",
        active: pathname === "/",
      },
    ];
    if (!offline) {
      tabs.push(
        { key: "forYou", label: t("forYou"), Icon: Sparkles, path: "/recommendations", active: under("/recommendations") },
        { key: "swipe", label: t("swipe"), Icon: GalleryHorizontalEnd, path: "/swipe", active: under("/swipe") },
        { key: "libraries", label: t("library"), Icon: Film, path: "/libraries", active: under("/libraries") || under("/library") },
      );
      if (plugins.length > 0) {
        // Plusieurs plugins : l'onglet prend le nom de celui qu'on regarde.
        const shown = plugins.length === 1 ? plugins[0] : activePlugin;
        tabs.push({
          key: "extensions",
          label: shown?.name ?? t("extensions"),
          Icon: shown?.Icon ?? Puzzle,
          path: plugins.length === 1 ? plugins[0].path : null,
          active: activePlugin !== undefined,
        });
      }
    }
    tabs.push({ key: "profile", label: t("profile"), Icon: User, path: "/profile", active: under("/profile") || under("/settings") });
    return { tabs, plugins, activePlugin };
  }, [t, to, pathname, offline, plugins]);
}
