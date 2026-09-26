import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { spacing, useContentPadding, useRailWidth, useResponsive, useThemedStyles, type AppTheme } from "../theme";
import { FadeIn, SubtleBackground } from "../components/ui";
import { useHeaderHeight } from "../components/PersistentHeader";
import { useScrollChromeHandler } from "../components/navigation/scrollChrome";
import { useProfileActions } from "../hooks/useProfileActions";
import { useConnectivity } from "../offline/useConnectivity";
import { useOfflineMode } from "../offline/useOfflineMode";
import { useOfflineVisibility } from "../hooks/offline/useOfflineVisibility";
import { ProfileAccountSections } from "./profile/ProfileAccountSections";
import { ProfileDetailPane } from "./profile/ProfileDetailPane";
import { ProfileHero } from "./profile/ProfileHero";
import { ProfilePaneContext } from "./profile/ProfilePaneContext";
import { ProfileSettingsSections } from "./profile/ProfileSettingsSections";
import { resolvePane, type PaneContext, type ProfilePaneId } from "./profile/profilePanes";

/** Sous cette largeur utile, deux colonnes écraseraient le détail : une seule liste. */
const SPLIT_MIN_WIDTH = 720;
const BOTTOM_CLEARANCE = 120;

/**
 * Profil — l'identité en tête, puis les réglages en neuf sections dont
 * l'ordre et les règles vivent dans `profile/profilePanes.ts`.
 *
 * Téléphone : une seule liste ; une ligne à chevron ouvre son écran
 * `/settings/*`. Tablette (portrait comme paysage) : maître-détail — la
 * liste à gauche, le volet choisi à droite, sans quitter l'onglet ; les
 * pages qui ont leur propre écran (Support, À propos, Jumeler TV,
 * Sessions, Mes titres) s'ouvrent comme sur téléphone.
 *
 * Hors ligne, il ne reste que ce qui vit sur l'appareil : tout ce qui parle
 * au serveur disparaît au lieu d'échouer.
 */
export function ProfileScreen() {
  const headerH = useHeaderHeight();
  const onScrollChrome = useScrollChromeHandler();
  const st = useThemedStyles(makeStyles);
  const actions = useProfileActions();
  const { user, isAdmin, userName, initial, serverUrl } = actions;
  const offline = useOfflineMode();
  const { state: connectivity } = useConnectivity();
  const { visible: offlineVisible } = useOfflineVisibility();
  const ctx: PaneContext = useMemo(() => ({ offline, isAdmin, offlineVisible }), [offline, isAdmin, offlineVisible]);

  const contentPad = useContentPadding();
  const { width, isTablet } = useResponsive();
  const railWidth = useRailWidth();
  const split = isTablet && width - railWidth >= SPLIT_MIN_WIDTH;
  const [chosen, setChosen] = useState<ProfilePaneId | null>(null);
  const pane = resolvePane(chosen, ctx);
  const selection = useMemo(() => ({ selected: pane, select: setChosen }), [pane]);

  const list = (
    <>
      <FadeIn delay={0}>
        <ProfileHero user={user} userName={userName} initial={initial} isAdmin={isAdmin} serverUrl={serverUrl} />
      </FadeIn>
      <ProfileSettingsSections ctx={ctx} />
      <ProfileAccountSections ctx={ctx} canGoOffline={connectivity === "online" && offlineVisible} actions={actions} />
    </>
  );

  if (!split) {
    return (
      <SubtleBackground ambient>
        <Animated.ScrollView
          style={st.fill}
          contentContainerStyle={{ paddingTop: headerH + spacing.xl, paddingBottom: BOTTOM_CLEARANCE, paddingHorizontal: contentPad }}
          showsVerticalScrollIndicator={false}
          onScroll={onScrollChrome}
          scrollEventThrottle={16}
        >
          {list}
        </Animated.ScrollView>
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground ambient>
      <ProfilePaneContext.Provider value={selection}>
        <View style={st.split}>
          <Animated.ScrollView
            style={[st.master, { width: Math.round(Math.min(400, Math.max(320, width * 0.34))) }]}
            contentContainerStyle={{ paddingTop: headerH + spacing.xl, paddingBottom: BOTTOM_CLEARANCE, paddingHorizontal: spacing.lg }}
            showsVerticalScrollIndicator={false}
            onScroll={onScrollChrome}
            scrollEventThrottle={16}
          >
            {list}
          </Animated.ScrollView>
          <ProfileDetailPane pane={pane} topInset={headerH} bottomInset={BOTTOM_CLEARANCE} />
        </View>
      </ProfilePaneContext.Provider>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  fill: { flex: 1 },
  split: { flex: 1, flexDirection: "row" as const },
  master: {
    flexGrow: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: t.colors.border.subtle,
  },
});
