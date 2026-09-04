import { useRecoPage } from "@tentacle-tv/api-client";
import { useRecoFilter } from "../../hooks/useRecoFilter";
import { RecoRowSlot } from "../reco/RecoRowSlot";
import { HomeRecoFilterChip } from "./HomeRecoFilterChip";

interface HomeRecoRowProps {
  rowKey: string;
  animDelay: number;
  /** Cette rangée porte la puce du filtre de plateformes (la première servie). */
  filterChip?: boolean;
}

// Un SEUL élément, d'identité stable : RecoRowSlot est mémoïsé, un élément
// neuf à chaque rendu re-rendrait la rangée entière.
const FILTER_CHIP = <HomeRecoFilterChip />;

/**
 * Une rangée `reco:<row>` de l'accueil configurable : lue dans LA page du
 * filtre du compte — la même entrée de cache que la page Recommandations et
 * que le héros « reco » (aucune requête par rangée, et « Pour vous » y est le
 * même qu'en face). Le store du filtre se lit de façon synchrone depuis le
 * miroir : la bonne page se demande dès le premier rendu. Rangée absente :
 * rien, jamais de squelette ici (l'accueil garde son dégradé silencieux).
 */
export function HomeRecoRow({ rowKey, animDelay, filterChip }: HomeRecoRowProps) {
  const { selected } = useRecoFilter();
  const { data: page } = useRecoPage(selected);
  const row = page?.rows.find((r) => r.key === rowKey);
  if (!row) return null;
  return (
    <RecoRowSlot
      row={row}
      animDelay={animDelay}
      headerTrailing={filterChip ? FILTER_CHIP : undefined}
    />
  );
}
