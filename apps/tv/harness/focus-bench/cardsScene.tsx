import { ScrollView } from "react-native";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusableRow } from "../../src/components/focus/FocusableRow";
import { useTVRemote } from "../../src/components/focus/useTVRemote";
import { TVScreenFrame } from "../../src/components/nav/TVScreenFrame";
import { TVPosterCard } from "../../src/components/cards/TVPosterCard";
import { TVEpisodeCard } from "../../src/components/cards/TVEpisodeCard";
import { TVRecoCard } from "../../src/components/cards/TVRecoCard";
import { TV_EPISODE_WIDTH, TV_POSTER_WIDTH } from "../../src/components/cards/cardSizes";
import { useTVCardActions } from "../../src/components/cards/actions/useTVCardActions";
import { POSTER_CARDS, RECO_CARDS, STILL_CARDS } from "./cardFixtures";

/**
 * Les VRAIES cartes du salon — affiches, vignettes 16:9, recommandations —
 * dans les vraies rangées, et la feuille d'actions de l'appui long. Au
 * repos, au focus, feuille ouverte : tout ce que le modèle des cartes sait
 * dire, sur des états variés (`cardFixtures.ts`), sans compte ni serveur.
 * La note passe par le relais du banc (`/api/ratings`, `proxy.mjs`).
 */

const renderPoster = (item: MediaItem, _i: number, focused: boolean) => <TVPosterCard item={item} focused={focused} />;
const renderStill = (item: MediaItem, _i: number, focused: boolean) => <TVEpisodeCard item={item} focused={focused} />;
const renderReco = (item: RecoRowItem, _i: number, focused: boolean) => <TVRecoCard item={item} focused={focused} />;
const mediaKey = (item: MediaItem) => item.Id;
const recoKey = (item: RecoRowItem) => item.key;
const noop = () => undefined;

export function CardsScene({ onExit }: { onExit: () => void }) {
  useTVRemote({ onBack: onExit });
  const cardActions = useTVCardActions();
  return (
    <TVScreenFrame>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }}>
        <FocusableRow
          title="Affiches"
          data={POSTER_CARDS}
          renderItem={renderPoster}
          keyExtractor={mediaKey}
          itemWidth={TV_POSTER_WIDTH.md}
          onItemPress={noop}
          onItemLongPress={cardActions.openPoster}
        />
        <FocusableRow
          title="Vignettes 16:9"
          data={STILL_CARDS}
          renderItem={renderStill}
          keyExtractor={mediaKey}
          itemWidth={TV_EPISODE_WIDTH.md}
          onItemPress={noop}
          onItemLongPress={cardActions.openLandscape}
        />
        <FocusableRow
          title="Recommandations"
          data={RECO_CARDS}
          renderItem={renderReco}
          keyExtractor={recoKey}
          itemWidth={TV_POSTER_WIDTH.md}
          onItemPress={noop}
          onItemLongPress={cardActions.openReco}
        />
      </ScrollView>
      {cardActions.sheet}
    </TVScreenFrame>
  );
}
