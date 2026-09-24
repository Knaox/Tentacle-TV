import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { extensionSectionId } from "@tentacle-tv/api-client";
import { useActivePlugins, type ActivePlugin } from "@/hooks/useActivePlugins";

/**
 * Les pages d'extension sur mobile ne sont plus des onglets : elles sont les
 * SECTIONS d'un onglet unique. Ce module décrit ces sections et décide de
 * l'identité de l'onglet (libellé, icône, visibilité) à partir des plugins
 * actifs. Une extension de plus ajoute des sections, jamais un onglet.
 */

export type FeatherName = keyof typeof Feather.glyphMap;

export interface ExtensionSection {
  /** `<pluginId>:<path>` — identité stable, lue et écrite dans `?section=`. */
  id: string;
  pluginId: string;
  pluginName: string;
  path: string;
  icon: FeatherName;
  /** Libellé du manifeste, déjà localisé (jamais une clé i18n). */
  label: string;
}

/** Un plugin et ses pages mobiles, tel que le sous-menu des extensions le présente. */
export interface ExtensionPluginGroup {
  pluginId: string;
  /** Nom court (« Vigie »), jamais la devise du manifeste. */
  name: string;
  icon: FeatherName;
  sections: ExtensionSection[];
}

export interface ExtensionTab {
  /** Faux sans aucune section : l'onglet se masque (`href: null`). */
  visible: boolean;
  label: string;
  icon: FeatherName;
  /** Plusieurs plugins publient des pages : l'onglet ouvre le sous-menu des plugins. */
  multiPlugin: boolean;
  sections: ExtensionSection[];
  /** Les plugins, dans l'ordre des manifestes. */
  plugins: ExtensionPluginGroup[];
}

// Icônes unicode des anciens manifestes → noms Feather.
const ICON_MAP: Record<string, FeatherName> = {
  "✦": "compass",
  "☰": "list",
  "▥": "bar-chart-2",
};

/** Un nom d'icône venu d'un manifeste ne casse jamais l'app : inconnu → repli. */
export function resolveIcon(icon: string | undefined, fallback: FeatherName): FeatherName {
  if (!icon) return fallback;
  const name = ICON_MAP[icon] ?? icon;
  return name in Feather.glyphMap ? (name as FeatherName) : fallback;
}

const DEFAULT_TAB_ICON: FeatherName = "grid";

function pickLabel(labels: Record<string, string> | undefined, lang: string): string | undefined {
  return labels?.[lang] ?? labels?.en;
}

/**
 * Le nom court d'un plugin, pour le bandeau : « Vigie — Demandes de médias »
 * se présente comme « Vigie ». La devise après le tiret reste un affichage
 * du manifeste, jamais une identité.
 */
export function shortPluginName(name: string): string {
  return name.split(/\s+[—–-]\s+/)[0].trim() || name;
}

/** Les pages mobiles de tous les plugins actifs, dans l'ordre des manifestes. */
export function buildExtensionSections(plugins: ActivePlugin[] | undefined, lang: string): ExtensionSection[] {
  return (plugins ?? []).flatMap((plugin) =>
    (plugin.navItems ?? [])
      .filter((item) => item.platforms.includes("mobile"))
      .map((item) => ({
        id: extensionSectionId(plugin.pluginId, item.path),
        pluginId: plugin.pluginId,
        pluginName: plugin.name,
        path: item.path,
        icon: resolveIcon(item.icon, "compass"),
        label: pickLabel(item.labels, lang) ?? plugin.name,
      })),
  );
}

type NavT = (key: "extensions") => string;

/** Les sections rangées par plugin, dans l'ordre de leur première apparition. */
export function groupSectionsByPlugin(
  plugins: ActivePlugin[] | undefined,
  sections: ExtensionSection[],
): ExtensionPluginGroup[] {
  const groups = new Map<string, ExtensionPluginGroup>();
  for (const section of sections) {
    let group = groups.get(section.pluginId);
    if (!group) {
      const plugin = plugins?.find((p) => p.pluginId === section.pluginId);
      group = {
        pluginId: section.pluginId,
        name: shortPluginName(section.pluginName),
        icon: resolveIcon(plugin?.tab?.icon, section.icon),
        sections: [],
      };
      groups.set(section.pluginId, group);
    }
    group.sections.push(section);
  }
  return [...groups.values()];
}

/**
 * Identité de l'onglet.
 *
 * - UN plugin : l'onglet porte SON nom et son icône (« Vigie ») et y mène
 *   directement — il n'y a rien à choisir, un nom générique n'aurait fait
 *   qu'éloigner l'utilisateur de ce qu'il cherche.
 * - PLUSIEURS : « Extensions », la grille, et l'appui ouvre le sous-menu des
 *   plugins (`ExtensionPicker`) ; chaque plugin garde ses pages en bandeau.
 *
 * Le nom vient du plugin (sa partie courte), jamais d'une page : un nom de page
 * (« Demandes ») laissait croire que l'onglet ne contenait qu'elle.
 */
export function resolveExtensionTab(
  plugins: ActivePlugin[] | undefined,
  sections: ExtensionSection[],
  t: NavT,
): ExtensionTab {
  const visible = sections.length > 0;
  const groups = groupSectionsByPlugin(plugins, sections);
  if (groups.length > 1) {
    return { visible, label: t("extensions"), icon: DEFAULT_TAB_ICON, multiPlugin: true, sections, plugins: groups };
  }
  const only = groups[0];
  return {
    visible,
    label: only ? only.name : t("extensions"),
    icon: only ? only.icon : DEFAULT_TAB_ICON,
    multiPlugin: false,
    sections,
    plugins: groups,
  };
}

function useInterfaceLang(): string {
  const { i18n } = useTranslation();
  return i18n.language?.slice(0, 2) ?? "en";
}

export function useExtensionSections(): ExtensionSection[] {
  const { data: plugins } = useActivePlugins();
  const lang = useInterfaceLang();
  return useMemo(() => buildExtensionSections(plugins, lang), [plugins, lang]);
}

export function useExtensionTab(): ExtensionTab {
  const { data: plugins } = useActivePlugins();
  const { t } = useTranslation("nav");
  const lang = useInterfaceLang();
  return useMemo(
    () => resolveExtensionTab(plugins, buildExtensionSections(plugins, lang), t),
    [plugins, lang, t],
  );
}
