import { memo, useCallback, useContext, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { OPEN_PAGE } from "@tentacle-tv/tv-core";
import { TV_STAGE } from "@tentacle-tv/theme";
import { previewStoreContext, usePreviewZoneHero } from "../cards/trailerPreviewPort";
import { FocusSection, type FocusSectionReveal } from "../focus/FocusSection";
import { FocusTarget } from "../focus/FocusTarget";
import { useRemoteHints } from "../remote/remoteHints";
import { HeroBannerArt } from "./HeroBannerArt";
import type { HeroModel } from "./heroTypes";

/**
 * La BANNIÈRE de l'Accueil et de « Pour vous » : UNE seule cible (tv-core
 * `hero/heroNav.ts`, d'après la Top Shelf d'Apple), la première section de la
 * page. Aucun bouton dedans : DROITE et GAUCHE tournent les titres (le port
 * les reçoit au-delà du bord ; GAUCHE retenu tant qu'il y a un titre avant),
 * BAS mène aux rangées. OK : la fiche, ou la demande hors bibliothèque ; OK
 * maintenu : le grand panneau (`onPress`, `onLongPress` — l'intégration les
 * tient de tv-core `cardPress` / `cardHold`).
 *
 * Focalisée, elle le dit à la scène de sa page (`usePreviewZoneHero`) : sa
 * bande-annonce se joue DERRIÈRE elle, et elle s'efface — son titre seul reste.
 * Sa clé de focus est celle du titre (`hero.primary.focusKey`, l'entrée de
 * l'Accueil) ; sa section, `section:hero`.
 */
const HERO_REVEAL: FocusSectionReveal = { mode: "start" };

export const HeroBanner = memo(function HeroBanner({ hero, okHint, onPress, onLongPress }: {
  hero: HeroModel;
  /** Ce que fait OK (« OK : ouvrir la fiche », « OK : demander ») ; défaut : la fiche. */
  okHint?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useTranslation("cards");
  const hints = useRemoteHints();
  const [focused, setFocused] = useState(false);
  usePreviewZoneHero(focused);
  const watching = useHeroWatching();
  const onFocusChange = useCallback((on: boolean) => setFocused(on), []);
  return (
    <FocusSection focusKey="section:hero" reveal={HERO_REVEAL} style={styles.section}>
      <View style={styles.frame}>
        <FocusTarget
          focusKey={hero.primary.focusKey}
          form="card"
          onPress={onPress}
          onLongPress={onLongPress}
          onFocusChange={onFocusChange}
          accessibilityLabel={hero.title}
          style={StyleSheet.absoluteFill}
        >
          {() => (
            <HeroBannerArt hero={hero} focused={focused} watching={watching} okHint={okHint ?? t("okOpenDetails")} holdHint={t(hints.holdForOptions)} />
          )}
        </FocusTarget>
      </View>
    </FocusSection>
  );
});

const NO_SUBSCRIBE = () => () => undefined;

/** La scène joue la bande-annonce de la bannière. */
function useHeroWatching(): boolean {
  const store = useContext(previewStoreContext);
  return useSyncExternalStore(store ? store.subscribe : NO_SUBSCRIBE, () => (store ? store.getInfo().watching === "hero" : false));
}

const styles = StyleSheet.create({
  section: { paddingTop: OPEN_PAGE.heroTop, height: OPEN_PAGE.heroTop + OPEN_PAGE.heroHeight + OPEN_PAGE.heroGap },
  frame: {
    marginLeft: TV_STAGE.contentLeft,
    width: OPEN_PAGE.width - TV_STAGE.contentLeft - OPEN_PAGE.safeRight,
    height: OPEN_PAGE.heroHeight,
  },
});
