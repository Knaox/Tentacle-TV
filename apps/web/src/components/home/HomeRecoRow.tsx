import { useRecoPage } from "@tentacle-tv/api-client";
import { useRecoFilter } from "../../hooks/useRecoFilter";
import { RecoRowSlot } from "../reco/RecoRowSlot";

interface HomeRecoRowProps {
  rowKey: string;
  animDelay: number;
  /** Les items MONTRÉS dans le bandeau « reco » de l'accueil — « Pour vous »
   *  les exclut, exactement comme la page Recommandations. */
  excludeKeys?: readonly string[];
}

/**
 * Une rangée `reco:<row>` de l'accueil configurable : lue dans LA page du
 * filtre du compte — la même entrée de cache que la page Recommandations et
 * que le héros « reco » (aucune requête par rangée, et « Pour vous » y est le
 * même qu'en face). Le store du filtre se lit de façon synchrone depuis le
 * miroir : la bonne page se demande dès le premier rendu. Rangée absente :
 * rien, jamais de squelette ici (l'accueil garde son dégradé silencieux).
 */
export function HomeRecoRow({ rowKey, animDelay, excludeKeys }: HomeRecoRowProps) {
  const { selected } = useRecoFilter();
  const { data: page } = useRecoPage(selected);
  const row = page?.rows.find((r) => r.key === rowKey);
  if (!row) return null;
  return <RecoRowSlot row={row} animDelay={animDelay} excludeKeys={excludeKeys} />;
}
