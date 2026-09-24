import { memo, useCallback } from "react";
import { Keyboard, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useRouter } from "expo-router";
import type { ExternalSearchItem, SearchProvider } from "@tentacle-tv/shared";
import { spacing } from "@/theme";
import { SearchSuggestPanel } from "./SearchSuggestPanel";
import type { SearchAssist } from "./useSearchAssist";
import { useSearchNavigation } from "./useSearchNavigation";

/**
 * Le panneau des suggestions d'une barre locale, À LA PLACE de la page tant
 * qu'on tape : il ne recouvre rien (aucun toucher perdu hors des limites d'un
 * parent), et il a toute la hauteur pour lui. « Rechercher » au clavier, ou une
 * requête reprise, le range : la page filtrée revient.
 *
 * Ouvrir un résultat range d'abord le clavier — l'écran suivant ne doit pas
 * hériter d'un champ actif.
 */
export const SearchAssistPane = memo(function SearchAssistPane({ assist }: { assist: SearchAssist }) {
  const router = useRouter();
  const nav = useSearchNavigation({ modal: false });

  const openItem = useCallback((id: string) => {
    Keyboard.dismiss();
    nav.openItem(id);
  }, [nav]);
  const openExternal = useCallback((provider: SearchProvider, item: ExternalSearchItem) => {
    Keyboard.dismiss();
    nav.openExternalItem(provider, item);
  }, [nav]);
  const seeAll = useCallback(() => {
    Keyboard.dismiss();
    router.push({ pathname: "/search", params: { q: assist.value.trim() } });
  }, [router, assist.value]);

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(110)} style={st.pane}>
      <SearchSuggestPanel
        query={assist.settled}
        suggestions={assist.suggestions}
        onQuery={assist.pick}
        onOpenItem={openItem}
        onOpenExternal={openExternal}
        onSeeAll={seeAll}
      />
    </Animated.View>
  );
});

const st = StyleSheet.create({
  pane: { flex: 1, paddingTop: spacing.sm },
});
