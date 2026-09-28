import { recoPosterUrl, useJellyfinClient, useSendRecoFeedback, type RecoRowItem } from "@tentacle-tv/api-client";
import { ExternalActionSheet } from "../../cards/ExternalActionSheet";
import { RecoReasonList } from "./RecoReasonList";

/**
 * `RecoActionSheet` de l'app : l'appui long sur une recommandation HORS
 * bibliothèque. C'est la feuille de TOUTES les cartes Vigie
 * (`ExternalActionSheet`) — « Demander », la note, Ma liste à l'arrivée —
 * avec ce qu'une recommandation ajoute : « Pourquoi ce titre », et « Ne plus
 * me proposer » (retrait optimiste de toutes les pages en cache). Un titre en
 * bibliothèque passe par `MediaActionSheet`, variante « reco » (`useItemSheets`
 * aiguille selon `jellyfinItemId`).
 */
export function RecoActionSheet({ item, onClose }: { item: RecoRowItem | null; onClose: () => void }) {
  const client = useJellyfinClient();
  const feedback = useSendRecoFeedback();
  const target = item && {
    title: { mediaType: item.mediaType, tmdbId: item.tmdbId },
    name: item.title,
    year: item.year,
    imageUrl: recoPosterUrl(item, (id) => client.getImageUrl(id, "Primary", { width: 240, quality: 85 })),
  };

  return (
    <ExternalActionSheet
      target={target}
      variant="reco"
      onClose={onClose}
      extra={item ? <RecoReasonList reasons={item.reasons} /> : undefined}
      onDismiss={item ? () => feedback.mutate({ itemKey: item.key, action: "dismissed" }) : undefined}
    />
  );
}
