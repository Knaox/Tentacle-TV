import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { PluginWebView } from "@/components/PluginWebView";
import type { ExtensionSection } from "@/hooks/useExtensionSections";

interface Props {
  section: ExtensionSection;
  active: boolean;
  /** Ce que l'écran a posé SOUS le bord bas (le bandeau replié) — à réserver en plus de la barre. */
  chromeBottomExtra?: number;
}

/**
 * Un volet par section, monté à la première visite puis CONSERVÉ : la page
 * garde son état et son défilement quand on change de section ou d'onglet.
 *
 * Les volets sont superposés plein cadre. L'inactif reste monté à sa vraie
 * taille, transparent, insensible au toucher et invisible pour les lecteurs
 * d'écran. Ni `display: none` (sous Fabric, iOS démonte la WebView et Android
 * la mesure 0 × 0 : page rechargée ou repliée), ni `zIndex` (réparentage
 * natif inutile : un volet transparent et non tapable n'a pas à être dessous).
 */
export const ExtensionPane = memo(function ExtensionPane({ section, active, chromeBottomExtra }: Props) {
  return (
    <View
      style={[StyleSheet.absoluteFill, active ? styles.shown : styles.hidden]}
      pointerEvents={active ? "auto" : "none"}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!active}
    >
      <PluginWebView
        pluginId={section.pluginId}
        path={section.path}
        label={section.label}
        padTop={false}
        controlsChrome={active}
        chromeBottomExtra={chromeBottomExtra}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  shown: { opacity: 1 },
  hidden: { opacity: 0 },
});
