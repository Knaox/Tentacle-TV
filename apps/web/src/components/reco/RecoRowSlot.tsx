import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRecoRow } from "@tentacle-tv/api-client";
import { RowHeader } from "../rows/RowHeader";
import { RecoRow } from "./RecoRow";
import { RecoRowSkeleton } from "./RecoRowSkeleton";

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
  rowKey: string;
  seedTitle?: string;
  animDelay: number;
  /** Page Recommandations : les items MONTRÉS dans le carrousel héros — la
   *  rangée les exclut (skip exact, pas « les N premiers »). */
  excludeKeys?: string[];
  /** Ids watch-provider sélectionnés (chips) — filtrage client pur. Un item
   *  sans donnée providers (méta inconnue) n'est PAS filtré. */
  providerFilter?: number[];
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
  providerFilter,
  pendingFallback = "none",
}: RecoRowSlotProps) {
  const { t } = useTranslation("reco");
  const { data, isPending } = useRecoRow(rowKey);
  const allItems = data?.items;
  // Mémoïsé : une identité neuve à chaque rendu re-rendrait toute la rangée.
  const items = useMemo(() => {
    if (!allItems?.length) return [];
    let out = allItems;
    if (excludeKeys?.length) {
      const excluded = new Set(excludeKeys);
      out = out.filter((i) => !excluded.has(i.key));
    }
    if (providerFilter?.length) {
      const wanted = new Set(providerFilter);
      // `providers` absent = méta inconnue : on garde l'item plutôt que de
      // le faire disparaître à tort.
      out = out.filter((i) => !i.providers || i.providers.some((p) => wanted.has(p.id)));
    }
    return out;
  }, [allItems, excludeKeys, providerFilter]);

  const title = rowKey.startsWith("becauseYouLiked:")
    ? t("rowBecauseYouLiked", { title: seedTitle ?? data?.seedTitle ?? "" })
    : rowKey.startsWith("withActor:")
      ? t("rowWithActor", { name: seedTitle ?? data?.seedTitle ?? "" })
      : t(ROW_TITLE_KEYS[rowKey] ?? "rowForYou");

  if (!allItems?.length) {
    // Silhouette seulement quand quelque chose ARRIVE (requête en vol ou
    // moteur au travail) — une rangée réellement vide reste invisible.
    const busy = isPending || data?.generating || data?.pending || data?.refining;
    return pendingFallback === "skeleton" && busy ? <RecoRowSkeleton /> : null;
  }
  if (!items.length) {
    // Vidée par le FILTRE : un état vide propre (la rangée existe, la
    // sélection ne matche pas) — le null silencieux reste pour le reste.
    if (providerFilter?.length) {
      return (
        <div className="mb-10">
          <RowHeader title={title} />
          <p className="row-gutter mt-2 text-sm text-content-tertiary">{t("providerRowEmpty")}</p>
        </div>
      );
    }
    return null;
  }

  return <RecoRow title={title} items={items} animDelay={animDelay} />;
}
