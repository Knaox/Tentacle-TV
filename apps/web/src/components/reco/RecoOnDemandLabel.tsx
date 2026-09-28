import { useTranslation } from "react-i18next";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { useExternalTitleState } from "../cards/external/useTitleProvider";

/**
 * Le mot de la pastille d'un titre recommandé hors bibliothèque : ce que
 * l'extension de demandes en dit (« Demandé », « En route »…) dès qu'elle le
 * sait, « À la demande » sinon. Une demande faite depuis le survol change le
 * mot tout de suite — l'extension rend l'état avec sa réponse.
 */
export function RecoOnDemandLabel({ item }: { item: Pick<RecoRowItem, "mediaType" | "tmdbId"> }) {
  const { t } = useTranslation("reco");
  const state = useExternalTitleState({ mediaType: item.mediaType, tmdbId: item.tmdbId });
  return <>{state?.badge?.label ?? t("onDemandBadge")}</>;
}
