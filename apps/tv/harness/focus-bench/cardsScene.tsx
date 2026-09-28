import { ScrollView } from "react-native";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusableRow } from "../../src/components/focus/FocusableRow";
import { useTVRemote } from "../../src/components/focus/useTVRemote";
import { TVScreenFrame } from "../../src/components/nav/TVScreenFrame";
import { TVPosterFrame, TVPosterMeta } from "../../src/components/cards/TVPosterCard";
import { TVEpisodeFrame, TVEpisodeMeta } from "../../src/components/cards/TVEpisodeCard";
import { TVRecoFrame, TVRecoMeta } from "../../src/components/cards/TVRecoCard";
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

// Comme l'accueil (`tvHomeRowRegistry`) : le visuel sous l'anneau, la légende dessous.
const renderPoster = (item: MediaItem, _i: number, focused: boolean) => (
  <TVPosterFrame item={item} width={TV_POSTER_WIDTH.md} focused={focused} />
);
const renderPosterMeta = (item: MediaItem) => <TVPosterMeta item={item} width={TV_POSTER_WIDTH.md} />;
const renderStill = (item: MediaItem, _i: number, focused: boolean) => <TVEpisodeFrame item={item} focused={focused} />;
const renderStillMeta = (item: MediaItem) => <TVEpisodeMeta item={item} />;
const renderReco = (item: RecoRowItem) => <TVRecoFrame item={item} />;
const renderRecoMeta = (item: RecoRowItem, _i: number, focused: boolean) => <TVRecoMeta item={item} focused={focused} />;
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
          renderBelow={renderPosterMeta}
          keyExtractor={mediaKey}
          itemWidth={TV_POSTER_WIDTH.md}
          onItemPress={noop}
          onItemLongPress={cardActions.openPoster}
        />
        <FocusableRow
          title="Vignettes 16:9"
          data={STILL_CARDS}
          renderItem={renderStill}
          renderBelow={renderStillMeta}
          keyExtractor={mediaKey}
          itemWidth={TV_EPISODE_WIDTH.md}
          onItemPress={noop}
          onItemLongPress={cardActions.openLandscape}
        />
        <FocusableRow
          title="Recommandations"
          data={RECO_CARDS}
          renderItem={renderReco}
          renderBelow={renderRecoMeta}
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
