import { useRecoPage } from "@tentacle-tv/api-client";
import { RecoRowSlot } from "../reco/RecoRowSlot";

/**
 * Une rangée `reco:<row>` de l'accueil configurable : lue dans la page
 * « all » (jamais filtrée sur l'accueil), la même entrée de cache que le
 * héros « reco » — aucune requête par rangée. Rangée absente : rien, jamais
 * de squelette ici (l'accueil garde son dégradé silencieux).
 */
export function HomeRecoRow({ rowKey, animDelay }: { rowKey: string; animDelay: number }) {
  const { data: page } = useRecoPage(null);
  const row = page?.rows.find((r) => r.key === rowKey);
  if (!row) return null;
  return <RecoRowSlot row={row} animDelay={animDelay} />;
}
