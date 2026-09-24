import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import { useExtensionTab, type ExtensionPluginGroup, type FeatherName } from "@/hooks/useExtensionSections";
import type { RailMenuItem } from "@/components/navigation/RailMenu";
import { resumeSectionFor, useActiveExtensionPlugin } from "./extensionNavState";

/**
 * L'onglet des extensions dans la navigation (barre basse, rail iPad et son
 * menu) — tout ce que la mise en page des onglets en sait :
 *
 * - un seul plugin : l'onglet porte son nom, l'appui y mène (rien à choisir) ;
 * - plusieurs : l'appui ouvre (ou referme) le sous-menu des plugins, l'appui
 *   long aussi ; sur l'onglet, il prend le nom et l'icône du plugin affiché —
 *   comme « Plus » prend le nom de la page courante sur le bureau (1.22.0) ;
 *   le menu du rail iPad liste chaque plugin.
 */
export function useExtensionNav() {
  const ext = useExtensionTab();
  const router = useRouter();
  const pathname = usePathname();
  const activePluginId = useActiveExtensionPlugin();
  const [pickerOpen, setPickerOpen] = useState(false);
  const onExtensions = pathname === "/extensions";
  const current = ext.multiPlugin && onExtensions
    ? ext.plugins.find((p) => p.pluginId === activePluginId)
    : undefined;

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const openPlugin = useCallback((plugin: ExtensionPluginGroup, sectionId?: string) => {
    setPickerOpen(false);
    const section = sectionId ?? resumeSectionFor(plugin.pluginId, plugin.sections[0]?.id ?? "");
    router.navigate({ pathname: "/extensions", params: { section } });
  }, [router]);

  const multi = ext.multiPlugin;
  const listeners = useMemo(() => ({
    tabPress: (e: { preventDefault: () => void }) => {
      if (!multi) return;
      e.preventDefault();
      setPickerOpen((open) => !open);
    },
    tabLongPress: () => {
      if (multi) setPickerOpen(true);
    },
  }), [multi]);

  const railItems = useMemo<RailMenuItem[]>(() => {
    if (!ext.visible) return [];
    if (!multi) return [{ href: "/extensions", icon: ext.icon, label: ext.label }];
    return ext.plugins.map((plugin) => ({
      key: `extension:${plugin.pluginId}`,
      href: {
        pathname: "/extensions",
        params: { section: resumeSectionFor(plugin.pluginId, plugin.sections[0]?.id ?? "") },
      },
      icon: plugin.icon,
      label: plugin.name,
      active: onExtensions && activePluginId === plugin.pluginId,
    }));
  }, [ext, multi, onExtensions, activePluginId]);

  const label: string = current?.name ?? ext.label;
  const icon: FeatherName = current?.icon ?? ext.icon;
  return { ext, label, icon, pickerOpen, closePicker, openPlugin, activePluginId, listeners, railItems };
}
