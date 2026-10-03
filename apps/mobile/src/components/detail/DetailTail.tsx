import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaRow } from "../MediaRow";
import { LicenseAttribution } from "../LicenseAttribution";
import { useAfterEnterTransition } from "@/hooks/useAfterEnterTransition";
import { DetailFacts } from "./DetailFacts";
import { SagaRow } from "./SagaRow";
import { IncludedInRow } from "./IncludedInRow";

interface Props {
  item: MediaItem;
  similar?: MediaItem[];
  /** Le rendu d'une carte de rangée — stable, celui du corps de la fiche. */
  renderCard: (item: MediaItem) => ReactNode;
}

/**
 * Le pied de la fiche — informations, licence, saga du film, collections,
 * titres similaires (une rangée de cartes entière). Sous le pli à
 * l'ouverture : il se monte à l'ARRIVÉE de l'écran (`useAfterEnterTransition`)
 * et non dans le rendu synchrone qui précède le glissement d'entrée. Composant
 * à part : son arrivée ne re-rend que lui, pas le corps au-dessus.
 */
export const DetailTail = memo(function DetailTail({ item, similar, renderCard }: Props) {
  const { t } = useTranslation("common");
  const arrived = useAfterEnterTransition();
  if (!arrived) return null;
  return (
    <>
      <DetailFacts item={item} />

      <LicenseAttribution item={item} />
      {/* La saga d'un film, comme au bureau : juste avant les similaires. */}
      {item.Type === "Movie" && <SagaRow item={item} />}
      <IncludedInRow itemId={item.Id} />
      {similar && similar.length > 0 && (
        <MediaRow title={t("recommendations")} data={similar} renderItem={renderCard} />
      )}
    </>
  );
});
