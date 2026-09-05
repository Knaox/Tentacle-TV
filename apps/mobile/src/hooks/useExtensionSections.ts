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

// Plugins connus sans champ `tab` dans leur manifeste : un nom parlant pour
// l'utilisateur plutôt que la marque du plugin.
const KNOWN_PLUGIN_TABS: Record<string, { icon: FeatherName; labelKey: "requests" }> = {
  seer: { icon: "send", labelKey: "requests" },
};

const DEFAULT_TAB_ICON: FeatherName = "grid";

function pickLabel(labels: Record<string, string> | undefined, lang: string): string | undefined {
  return labels?.[lang] ?? labels?.en;
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

type NavT = (key: "extensions" | "requests") => string;

/**
 * Identité de l'onglet. Plusieurs plugins → « Extensions » + grille. Un seul →
 * le manifeste (`tab.labels[lang]` → `tab.labels.en`), sinon la table des
 * plugins connus, sinon le nom du plugin ; même cascade pour l'icône, avec
 * l'icône de la première page en avant-dernier recours.
 */
export function resolveExtensionTab(
  plugins: ActivePlugin[] | undefined,
  sections: ExtensionSection[],
  lang: string,
  t: NavT,
): ExtensionTab {
  const visible = sections.length > 0;
  const pluginIds = new Set(sections.map((s) => s.pluginId));
  if (pluginIds.size > 1) {
    return { visible, label: t("extensions"), icon: DEFAULT_TAB_ICON, multiPlugin: true, sections };
  }
  const first = sections[0];
  const plugin = first ? plugins?.find((p) => p.pluginId === first.pluginId) : undefined;
  const known = first ? KNOWN_PLUGIN_TABS[first.pluginId] : undefined;
  const label =
    pickLabel(plugin?.tab?.labels, lang) ??
    (known ? t(known.labelKey) : undefined) ??
    plugin?.name ??
    t("extensions");
  const icon = resolveIcon(plugin?.tab?.icon, known?.icon ?? first?.icon ?? DEFAULT_TAB_ICON);
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
    () => resolveExtensionTab(plugins, buildExtensionSections(plugins, lang), lang, t),
    [plugins, lang, t],
  );
}
