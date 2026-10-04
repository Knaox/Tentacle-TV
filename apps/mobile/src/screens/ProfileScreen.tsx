import { useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { spacing, useContentPadding, useRailWidth, useResponsive, useThemedStyles, type AppTheme } from "../theme";
import { FadeIn, SubtleBackground } from "../components/ui";
import { useHeaderHeight } from "../components/PersistentHeader";
import { useScrollChromeHandler } from "../components/navigation/scrollChrome";
import { useProfileActions } from "../hooks/useProfileActions";
import { ProfileActionsProvider } from "./profile/ProfileEntryActions";
import { ProfileDetailPane } from "./profile/ProfileDetailPane";
import { ProfileFooter, ProfileStatsCard } from "./profile/ProfileFooter";
import { ProfileHero } from "./profile/ProfileHero";
import { ProfileSectionList } from "./profile/ProfileSectionList";
import { findSection, resolveSection, type ProfileSectionId } from "./profile/profileStructure";
import { useProfileContext } from "./profile/useProfileContext";

/** Sous cette largeur utile, deux colonnes écraseraient le détail : une seule liste. */
const SPLIT_MIN_WIDTH = 720;
const BOTTOM_CLEARANCE = 120;

/**
 * Profil — l'identité en tête, « Mes statistiques », puis SIX rubriques au
 * plus (Compte, Lecture, Apparence, Notifications, Serveur, Aide), et « Se
 * déconnecter » en dernier. La structure — ce que chaque rubrique contient,
 * et quand — vit dans `profile/profileSections.ts` ; cet écran n'est qu'une
 * mise en page.
 *
 * Téléphone : une rubrique ouvre sa page (`/profile/<rubrique>`), une ligne
 * de la page ouvre son écran — deux niveaux, jamais trois. Tablette
 * (portrait comme paysage) : les rubriques à gauche, la page choisie à
 * droite, et ses volets dans la même colonne.
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
  const ctx = useProfileContext();

  const contentPad = useContentPadding();
  const { width, isTablet } = useResponsive();
  const railWidth = useRailWidth();
  const split = isTablet && width - railWidth >= SPLIT_MIN_WIDTH;
  const [chosen, setChosen] = useState<ProfileSectionId | null>(null);
  const sectionId = resolveSection(chosen, ctx);
  const section = sectionId ? findSection(sectionId) : undefined;

  const list = (
    <>
      <FadeIn delay={0}>
        <ProfileHero user={user} userName={userName} initial={initial} isAdmin={isAdmin} serverUrl={serverUrl} />
      </FadeIn>
      <FadeIn delay={40}>
        <ProfileStatsCard ctx={ctx} />
        <ProfileSectionList ctx={ctx} selected={split ? sectionId : undefined} onSelect={split ? setChosen : undefined} />
        <ProfileFooter onLogout={actions.handleLogout} />
      </FadeIn>
    </>
  );

  if (!split) {
    return (
      <SubtleBackground ambient>
        <ProfileActionsProvider value={actions}>
          <Animated.ScrollView
            style={st.fill}
            contentContainerStyle={{ paddingTop: headerH + spacing.xl, paddingBottom: BOTTOM_CLEARANCE, paddingHorizontal: contentPad }}
            showsVerticalScrollIndicator={false}
            onScroll={onScrollChrome}
            scrollEventThrottle={16}
          >
            {list}
          </Animated.ScrollView>
        </ProfileActionsProvider>
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground ambient>
      <ProfileActionsProvider value={actions}>
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
          {section ? (
            <ProfileDetailPane key={section.id} section={section} ctx={ctx} topInset={headerH} bottomInset={BOTTOM_CLEARANCE} />
          ) : null}
        </View>
      </ProfileActionsProvider>
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
