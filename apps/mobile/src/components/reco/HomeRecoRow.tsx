import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { recoRowTitle, useRecoPage, useRecoSettings } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { FadeIn } from "@/components/ui";
import { homeRowFadeDelay } from "@/components/home/homeRowFade";
import { RecoRow } from "./RecoRow";

interface Props {
  /** La clé servie (`forYou`, `trending`…), sans son préfixe `reco:`. */
  rowKey: string;
  index: number;
  accessory?: ReactNode;
  canOpen: (item: RecoRowItem) => boolean;
  onItemPress: (item: RecoRowItem) => void;
  onItemLongPress: (item: RecoRowItem) => void;
}

/**
 * Une rangée `reco:<row>` de l'accueil : lue dans LA page du filtre du compte
 * — la même que le web et la TV, une seule requête partagée par toutes les
 * rangées reco (même clé TanStack). Rangée absente : rien, jamais de
 * squelette (l'accueil garde son dégradé silencieux).
 */
export function HomeRecoRow({ rowKey, index, accessory, canOpen, onItemPress, onItemLongPress }: Props) {
  const { t } = useTranslation("reco");
  const settings = useRecoSettings();
  // Attendre le filtre du compte : sans cette garde, le premier rendu
  // demanderait la page « toutes plateformes » puis la page filtrée (deux
  // fois ~150 Ko). En erreur (vieux serveur) : page « toutes plateformes ».
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: page } = useRecoPage(settings.data?.providerFilter ?? [], { enabled: settingsReady });
  const row = page?.rows.find((r) => r.key === rowKey);
  if (!row) return null;
  const { key, params } = recoRowTitle(row);
  return (
    <FadeIn delay={homeRowFadeDelay(index)}>
      <RecoRow
        title={t(key, params)}
        items={row.items}
        accessory={accessory}
        canOpen={canOpen}
        onItemPress={onItemPress}
        onItemLongPress={onItemLongPress}
      />
    </FadeIn>
  );
}
