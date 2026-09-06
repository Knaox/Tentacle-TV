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

export interface ExtensionTab {
  /** Faux sans aucune section : l'onglet se masque (`href: null`). */
  visible: boolean;
  label: string;
  icon: FeatherName;
  /** Plusieurs plugins publient des pages : libellé générique, sections groupées. */
  multiPlugin: boolean;
  sections: ExtensionSection[];
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

/**
 * Identité de l'onglet. Le libellé est FIXE, « Extensions » : un nom de page
 * (« Demandes ») laissait croire que l'onglet ne contenait qu'elle, alors
 * qu'il regroupe toutes les pages des plugins — c'est le bandeau qui nomme le
 * plugin devant ses pages. Le champ `tab.labels` du manifeste reste accepté
 * par le serveur, mais n'est plus consommé ici pour la même raison. Un seul
 * plugin peut encore choisir son icône (`tab.icon`) ; plusieurs → la grille.
 */
export function resolveExtensionTab(
  plugins: ActivePlugin[] | undefined,
  sections: ExtensionSection[],
  t: NavT,
): ExtensionTab {
  const visible = sections.length > 0;
  const pluginIds = new Set(sections.map((s) => s.pluginId));
  const label = t("extensions");
  if (pluginIds.size > 1) {
    return { visible, label, icon: DEFAULT_TAB_ICON, multiPlugin: true, sections };
  }
  const first = sections[0];
  const plugin = first ? plugins?.find((p) => p.pluginId === first.pluginId) : undefined;
  const icon = resolveIcon(plugin?.tab?.icon, DEFAULT_TAB_ICON);
  return { visible, label, icon, multiPlugin: false, sections };
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
