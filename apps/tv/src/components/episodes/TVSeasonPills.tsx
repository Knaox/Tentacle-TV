import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TVFocusGuideView, View } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { Colors, Spacing, Fonts, Radius, brandAlpha } from "../../theme/colors";

/** Hauteur d'une pastille (12 + texte 15 + 12, bordure comprise). */
const PILL_HEIGHT = 44;
/** Réserve verticale autour de la bande : l'anneau et l'agrandissement de la
 *  pastille focalisée y passent sans être rognés par le défilement. */
const BAND_BLEED = 8;

/**
 * La bande des saisons, extraite de la liste d'épisodes.
 *
 * **Sa hauteur est réservée avant que les saisons arrivent.** Elle naissait à
 * zéro puis prenait une cinquantaine de points à la réponse du serveur : toute
 * la liste descendait d'un coup, épisode focalisé compris.
 *
 * **On y entre par la saison AFFICHÉE**, pas par la pastille que l'abscisse du
 * point de départ désignait — la saison 4 quand on remontait de l'épisode 1 de
 * la saison 11. C'est la zone `saisons` de la LG (entrée sur `aria-selected`) :
 * un guide de focus dont la destination est l'onglet actif.
 */
export const TVSeasonPills = memo(function TVSeasonPills({
  seasons,
  activeSeasonId,
  onSelect,
}: {
  seasons: MediaItem[] | undefined;
  activeSeasonId: string | undefined;
  onSelect: (seasonId: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  // Le calage initial sur la saison active — une seule fois, à l'arrivée.
  const wedged = useRef(false);
  const [activeNode, setActiveNode] = useState<View | null>(null);
  const destinations = useMemo(() => (activeNode ? [activeNode] : []), [activeNode]);

  const wedge = useCallback((x: number) => {
    if (wedged.current) return;
    wedged.current = true;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - Spacing.screenPadding), animated: false });
  }, []);

  return (
    <TVFocusGuideView
      destinations={destinations}
      style={{ height: PILL_HEIGHT + BAND_BLEED * 2 }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: Spacing.screenPadding,
          paddingVertical: BAND_BLEED,
          gap: 10,
        }}
      >
        {(seasons ?? []).map((season) => {
          const active = season.Id === activeSeasonId;
          return (
            // Enfant direct du ScrollView : son layout.x est relatif au contenu.
            <View
              key={season.Id}
              onLayout={active ? (e) => wedge(e.nativeEvent.layout.x) : undefined}
            >
              <Focusable
                ref={active ? setActiveNode : undefined}
                variant="button"
                focusRadius={Radius.pill}
                onPress={() => onSelect(season.Id)}
                accessibilityLabel={season.Name}
              >
                <View style={{
                  height: PILL_HEIGHT, justifyContent: "center",
                  paddingHorizontal: 24, borderRadius: Radius.pill,
                  backgroundColor: active ? brandAlpha(0.18) : Colors.ctaGhostBg,
                  borderWidth: 1,
                  borderColor: active ? brandAlpha(0.45) : Colors.glassBorder,
                }}>
                  <Text style={{
                    color: active ? Colors.accentPurpleLight : Colors.textSecondary,
                    fontSize: 15,
                    fontFamily: active ? Fonts.bold : Fonts.medium,
                  }}>
                    {season.Name}
                  </Text>
                </View>
              </Focusable>
            </View>
          );
        })}
      </ScrollView>
    </TVFocusGuideView>
  );
});
