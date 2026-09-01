import { useTranslation } from "react-i18next";
import { useRecoRow } from "@tentacle-tv/api-client";
import { RecoRow } from "./RecoRow";

const ROW_TITLE_KEYS: Record<string, string> = {
  forYou: "rowForYou",
  inLibrary: "rowInLibrary",
  discover: "rowDiscover",
  community: "rowCommunity",
  exploration: "rowExploration",
};

interface RecoRowSlotProps {
  rowKey: string;
  seedTitle?: string;
  animDelay: number;
  /** Page Recommandations : la tête de « Pour vous » vit déjà dans le héros. */
  skipFirst?: boolean;
}

/**
 * Une rangée de recommandation autonome : requête, titre localisé, rendu.
 * Partagée entre la page Recommandations et l'accueil configurable — une
 * rangée vide ne rend RIEN (dégradé silencieux).
 */
export function RecoRowSlot({ rowKey, seedTitle, animDelay, skipFirst }: RecoRowSlotProps) {
  const { t } = useTranslation("reco");
  const { data } = useRecoRow(rowKey);
  if (!data?.items?.length) return null;

  const items = skipFirst ? data.items.slice(1) : data.items;
  if (!items.length) return null;

  const title = rowKey.startsWith("becauseYouLiked:")
    ? t("rowBecauseYouLiked", { title: seedTitle ?? data.seedTitle ?? "" })
    : t(ROW_TITLE_KEYS[rowKey] ?? "rowForYou");

  return <RecoRow title={title} items={items} animDelay={animDelay} />;
}
