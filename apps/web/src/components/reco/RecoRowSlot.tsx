import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { recoRowTitle } from "@tentacle-tv/api-client";
import type { RecoPageRow } from "@tentacle-tv/api-client";
import { RecoRow } from "./RecoRow";

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

  // Titre : la table partagée (accueil, éditeur, mobile et TV lisent la même).
  const { key: titleKey, params } = recoRowTitle(row);
  const title = t(titleKey, params);

  if (items.length === 0) return null;
  return <RecoRow title={title} items={items} animDelay={animDelay} />;
});
