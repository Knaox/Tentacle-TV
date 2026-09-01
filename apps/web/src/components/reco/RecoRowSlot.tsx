import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRecoRow } from "@tentacle-tv/api-client";
import { RecoRow } from "./RecoRow";
import { RecoRowSkeleton } from "./RecoRowSkeleton";

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
  /** Page Recommandations : les items MONTRÉS dans le carrousel héros — la
   *  rangée les exclut (skip exact, pas « les N premiers »). */
  excludeKeys?: string[];
  /** « skeleton » : silhouette tant que la rangée se génère (page Reco) ;
   *  « none » (défaut) : l'accueil garde son dégradé silencieux. */
  pendingFallback?: "skeleton" | "none";
}

/**
 * Une rangée de recommandation autonome : requête, titre localisé, rendu.
 * Partagée entre la page Recommandations et l'accueil configurable — une
 * rangée vide ne rend RIEN (dégradé silencieux), sauf squelette demandé.
 */
export function RecoRowSlot({
  rowKey,
  seedTitle,
  animDelay,
  excludeKeys,
  pendingFallback = "none",
}: RecoRowSlotProps) {
  const { t } = useTranslation("reco");
  const { data, isPending } = useRecoRow(rowKey);
  const allItems = data?.items;
  // Mémoïsé : une identité neuve à chaque rendu re-rendrait toute la rangée.
  const items = useMemo(() => {
    if (!allItems?.length) return [];
    if (!excludeKeys?.length) return allItems;
    const excluded = new Set(excludeKeys);
    return allItems.filter((i) => !excluded.has(i.key));
  }, [allItems, excludeKeys]);

  if (!allItems?.length) {
    // Silhouette seulement quand quelque chose ARRIVE (requête en vol ou
    // moteur au travail) — une rangée réellement vide reste invisible.
    const busy = isPending || data?.generating || data?.pending || data?.refining;
    return pendingFallback === "skeleton" && busy ? <RecoRowSkeleton /> : null;
  }
  if (!items.length) return null;

  const title = rowKey.startsWith("becauseYouLiked:")
    ? t("rowBecauseYouLiked", { title: seedTitle ?? data?.seedTitle ?? "" })
    : t(ROW_TITLE_KEYS[rowKey] ?? "rowForYou");

  return <RecoRow title={title} items={items} animDelay={animDelay} />;
}
