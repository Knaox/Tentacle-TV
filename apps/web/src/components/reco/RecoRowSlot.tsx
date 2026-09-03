import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { RecoPageRow } from "@tentacle-tv/api-client";
import { RecoRow } from "./RecoRow";

const ROW_TITLE_KEYS: Record<string, string> = {
  forYou: "rowForYou",
  inLibrary: "rowInLibrary",
  discover: "rowDiscover",
  community: "rowCommunity",
  exploration: "rowExploration",
  trending: "rowTrending",
  serverPulse: "rowServerPulse",
  bestOfLibrary: "rowBestOfLibrary",
  anime: "rowAnime",
};

interface RecoRowSlotProps {
  /** La rangée SERVIE (page en une requête) — plus de requête par rangée,
   *  plus de filtre client : le serveur a déjà filtré, strictement. */
  row: RecoPageRow;
  animDelay: number;
  /** Page Recommandations : les items MONTRÉS dans le carrousel héros — la
   *  rangée les exclut (skip exact, pas « les N premiers »). */
  excludeKeys?: readonly string[];
}

/**
 * Une rangée de recommandation : titre localisé, rendu. Partagée entre la
 * page Recommandations et l'accueil configurable. Mémoïsée : le partage
 * structurel de TanStack garde `row` référentiellement stable quand rien
 * n'a changé — un drapeau qui bascule ne re-rend pas treize rangées.
 */
export const RecoRowSlot = memo(function RecoRowSlot({ row, animDelay, excludeKeys }: RecoRowSlotProps) {
  const { t } = useTranslation("reco");
  const items = useMemo(() => {
    if (!excludeKeys?.length) return row.items;
    const excluded = new Set(excludeKeys);
    return row.items.filter((item) => !excluded.has(item.key));
  }, [row.items, excludeKeys]);

  const title = row.key.startsWith("becauseYouLiked:")
    ? t("rowBecauseYouLiked", { title: row.seedTitle ?? "" })
    : row.key.startsWith("withActor:")
      ? t("rowWithActor", { name: row.seedTitle ?? "" })
      : t(ROW_TITLE_KEYS[row.key] ?? "rowForYou");

  if (items.length === 0) return null;
  return <RecoRow title={title} items={items} animDelay={animDelay} />;
});
