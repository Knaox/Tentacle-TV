/**
 * Octave (mobile) — la COQUILLE du mode : la pile des pages (`children`, la
 * `Stack` d'expo-router), la barre d'onglets en verre (téléphone) ou la barre
 * latérale (tablette) qui restent sur toute page empilée, le mini-lecteur, les
 * recouvrements et fournisseurs des axes (registre). Publie ce qu'elle occupe
 * (`OctaveChromeContext`) et garde la page affichée pour le prochain lancement.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useGlobalSearchParams, usePathname } from "expo-router";
import { markBoot } from "@/bootIntro/bootTimeline";
import { useResponsive } from "@/theme";
import { rememberOctavePath } from "../cache/octavePageStore";
import { octaveOverlays, octaveProviders } from "../registry/octaveRegistry";
import { useOctaveColors } from "../theme/octaveColors";
import { OCTAVE_MINI_GAP, OCTAVE_SIDEBAR_WIDTH, OctaveChromeContext, type OctaveChrome } from "./octaveChrome";
import { OctaveMiniPlayerSlot } from "./OctaveMiniPlayerSlot";
import { OctaveSidebar } from "./OctaveSidebar";
import { OctaveTabBar, useOctaveTabBarHeight } from "./OctaveTabBar";

/** Garde l'adresse affichée (la question d'une recherche comprise, `?q=`). */
function usePageMemory(): void {
  const pathname = usePathname();
  const { q } = useGlobalSearchParams<{ q?: string }>();
  const query = typeof q === "string" && q ? `?q=${encodeURIComponent(q)}` : "";
  useEffect(() => {
    rememberOctavePath(`${pathname}${query}`);
  }, [pathname, query]);
}

function withProviders(children: ReactNode): ReactNode {
  return octaveProviders.reduceRight<ReactNode>((inner, Provider) => <Provider>{inner}</Provider>, children);
}

export function OctaveShell({ children }: { children: ReactNode }) {
  const { isTablet } = useResponsive();
  const colors = useOctaveColors();
  const tabBar = useOctaveTabBarHeight();
  const [miniPlayerHeight, setMiniPlayerHeight] = useState(0);
  usePageMemory();
  useEffect(() => markBoot("octaveShell"), []);

  const layout = isTablet ? "tablet" : "phone";
  const chrome = useMemo<OctaveChrome>(() => {
    const tabBarHeight = isTablet ? 0 : tabBar;
    const mini = miniPlayerHeight > 0 ? miniPlayerHeight + OCTAVE_MINI_GAP : 0;
    return {
      layout,
      sidebarWidth: isTablet ? OCTAVE_SIDEBAR_WIDTH : 0,
      tabBarHeight,
      miniPlayerHeight,
      bottomInset: (isTablet ? 16 : tabBarHeight) + mini + 24,
    };
  }, [layout, isTablet, tabBar, miniPlayerHeight]);

  return (
    <OctaveChromeContext.Provider value={chrome}>
      {withProviders(
        <View style={[styles.root, { backgroundColor: colors.ink }]}>
          <View style={styles.row}>
            {isTablet ? <OctaveSidebar /> : null}
            <View style={styles.pages}>{children}</View>
          </View>
          {isTablet ? null : <OctaveTabBar />}
          <OctaveMiniPlayerSlot layout={layout} tabBarHeight={chrome.tabBarHeight} onHeight={setMiniPlayerHeight} />
          {octaveOverlays.map((Overlay, i) => (
            <Overlay key={i} />
          ))}
        </View>,
      )}
    </OctaveChromeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  pages: { flex: 1, overflow: "hidden" },
});
