/**
 * Octave (mobile, tablette) — la BARRE LATÉRALE, comme celle du bureau : la
 * marque, les trois destinations, les raccourcis de la bibliothèque (titres
 * likés, playlists), et en bas le retour aux films et séries. Toujours là,
 * même sur une page empilée ; l'onglet d'origine reste allumé.
 */

import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { Clapperboard, Heart, ListMusic, type LucideIcon } from "lucide-react-native";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { useOctaveColors, type OctaveColors } from "../theme/octaveColors";
import { useLeaveOctave } from "../mode/useOctaveSwitch";
import { octaveScreen } from "../registry/octaveRegistry";
import { OctaveRequires } from "../registry/OctaveRequires";
import type { OctaveScreenName } from "../registry/octaveRegistryTypes";
import { OCTAVE_SIDEBAR_WIDTH } from "./octaveChrome";
import { OCTAVE_NAV_ITEMS } from "./octaveNavItems";
import { useOctaveTab } from "./useOctaveTab";

interface RowProps {
  label: string;
  Icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
  colors: OctaveColors;
  hint?: string;
}

const SidebarRow = memo(function SidebarRow({ label, Icon, selected, onPress, colors, hint }: RowProps) {
  const tint = selected ? colors.accentText : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && { backgroundColor: colors.accentSoft }, pressed && !selected && { backgroundColor: colors.pressed }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Icon size={20} color={tint} strokeWidth={selected ? 2.4 : 2} />
      <Text style={[styles.rowLabel, { color: selected ? colors.text : colors.textSecondary, fontWeight: selected ? "700" : "500" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

/** Un raccourci n'existe que si l'écran qu'il ouvre a son droit. */
function ScreenShortcut({ screen, children }: { screen: OctaveScreenName; children: ReactNode }) {
  return <OctaveRequires requires={octaveScreen(screen)?.requires}>{children}</OctaveRequires>;
}

export const OctaveSidebar = memo(function OctaveSidebar() {
  const insets = useSafeAreaInsets();
  const colors = useOctaveColors();
  const { t } = useTranslation("music");
  const { t: ts } = useTranslation("octaveShell");
  const { active, go } = useOctaveTab();
  const pathname = usePathname();
  const router = useRouter();
  const leave = useLeaveOctave();
  const open = (path: string) => {
    if (pathname !== path) router.push(path as Href);
  };

  return (
    <View
      style={[styles.bar, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16), paddingLeft: insets.left + 12, backgroundColor: colors.raised, borderRightColor: colors.line }]}
      accessibilityLabel={ts("mobile.sidebar")}
    >
      <Text style={[styles.brand, { color: colors.text }]} accessibilityRole="header" accessibilityLabel={ts("signature.label")}>
        Octave
      </Text>
      <View style={styles.group}>
        {OCTAVE_NAV_ITEMS.map(({ tab, labelKey, Icon }) => (
          <SidebarRow key={tab} label={t(labelKey)} Icon={Icon} selected={tab === active && (tab !== "library" || pathname === octavePaths.library)} onPress={() => go(tab)} colors={colors} />
        ))}
      </View>
      <Text style={[styles.section, { color: colors.textTertiary }]}>{t("nav.yourPlaylists")}</Text>
      <View style={styles.group}>
        <ScreenShortcut screen="liked">
          <SidebarRow label={t("nav.liked")} Icon={Heart} selected={pathname === octavePaths.liked} onPress={() => open(octavePaths.liked)} colors={colors} />
        </ScreenShortcut>
        <ScreenShortcut screen="playlists">
          <SidebarRow label={t("nav.playlists")} Icon={ListMusic} selected={pathname === octavePaths.playlists} onPress={() => open(octavePaths.playlists)} colors={colors} />
        </ScreenShortcut>
      </View>
      <View style={styles.spacer} />
      <SidebarRow label={ts("backToFilms.label")} hint={ts("backToFilms.hint")} Icon={Clapperboard} selected={false} onPress={leave} colors={colors} />
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { width: OCTAVE_SIDEBAR_WIDTH, paddingRight: 12, borderRightWidth: StyleSheet.hairlineWidth },
  brand: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, paddingHorizontal: 12, marginBottom: 20 },
  group: { gap: 2 },
  section: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 12, marginTop: 24, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: 12 },
  rowLabel: { fontSize: 15, flexShrink: 1 },
  spacer: { flex: 1 },
});
