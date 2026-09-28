import { recoPosterUrl, useJellyfinClient, useSendRecoFeedback } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { ExternalActionSheet } from "@/components/external/ExternalActionSheet";

interface Props {
  /** L'item visé par l'appui long ; null = feuille fermée. */
  item: RecoRowItem | null;
  onClose: () => void;
}

/**
 * L'appui long sur une recommandation HORS bibliothèque : la feuille de TOUTES
 * les cartes Vigie (`ExternalActionSheet`) — « Demander », Ma liste à
 * l'arrivée, la note — avec ce qu'une recommandation ajoute : « Pourquoi ce
 * titre », et « Ne plus me proposer » (retrait optimiste de toutes les pages en
 * cache). Un titre en bibliothèque passe par MediaActionSheet — favoris, Ma
 * liste, vu — comme les autres rangées.
 */
export function RecoActionSheet({ item, onClose }: Props) {
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
      reasons={item?.reasons}
      onDismiss={item ? () => feedback.mutate({ itemKey: item.key, action: "dismissed" }) : undefined}
    />
  );
}
