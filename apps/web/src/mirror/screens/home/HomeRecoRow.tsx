import { useTranslation } from "react-i18next";
import { recoRowTitleText, useRecoPageVisit } from "@tentacle-tv/api-client";
import { useRecoFilter } from "../../../hooks/useRecoFilter";
import { FadeIn, homeRowFadeDelay } from "../../hero/FadeIn";
import { RecoRow, type RecoRowActions } from "../forYou/RecoRow";
import { RecoFilterChip } from "./RecoFilterChip";

// Un seul élément, d'identité stable : RecoRow est mémoïsée.
const FILTER_CHIP = <RecoFilterChip />;

/**
 * `HomeRecoRow` de l'app : une rangée `reco:<row>` lue dans LA page du filtre
 * du compte — la même entrée de cache que Pour vous et le héros « reco »
 * (aucune requête par rangée). Le filtre se lit de façon synchrone dans le
 * store du web : la bonne page se demande dès le premier rendu. Rangée
 * absente : rien, jamais de squelette.
 */
export function HomeRecoRow({ rowKey, index, filterChip, onSeeAll, ...actions }: {
  rowKey: string;
  index: number;
  filterChip: boolean;
  onSeeAll: () => void;
} & RecoRowActions) {
  const { t, i18n } = useTranslation("reco");
  const { selected } = useRecoFilter();
  const { data: page } = useRecoPageVisit(selected);
  const row = page?.rows.find((r) => r.key === rowKey);
  if (!row) return null;
  return (
    <FadeIn delay={homeRowFadeDelay(index)}>
      <RecoRow
        title={recoRowTitleText(row, t, { locale: i18n.language })}
        items={row.items}
        accessory={filterChip ? FILTER_CHIP : undefined}
        onSeeAll={onSeeAll}
        {...actions}
      />
    </FadeIn>
  );
}
