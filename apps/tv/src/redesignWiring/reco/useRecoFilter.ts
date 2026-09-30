import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRecoSettings, useSaveRecoProviderFilter } from "@tentacle-tv/api-client";
import { familyOfProviderId } from "@tentacle-tv/shared";

/**
 * La pastille du filtre de plateformes du COMPTE (« Netflix · Disney+ »),
 * posée sur la première rangée recommandée : les noms viennent de la
 * constante partagée, sans réseau ; un appui retire le filtre — du compte,
 * donc aussi sur le web et le mobile. Rien sans filtre.
 */
export function useRecoFilter(): { filter: { label: string } | null; removeFilter: () => void } {
  const { t } = useTranslation("reco");
  const { data: settings } = useRecoSettings();
  const save = useSaveRecoProviderFilter();
  const providerFilter = settings?.providerFilter;
  const filter = useMemo(() => {
    if (!providerFilter || providerFilter.length === 0) return null;
    const names = [...new Set(providerFilter.map((id) => familyOfProviderId(id)?.label).filter((name): name is string => !!name))];
    return { label: names.length > 0 ? names.join(" · ") : t("homeFilterGeneric") };
  }, [providerFilter, t]);
  const { mutate } = save;
  const removeFilter = useCallback(() => mutate([]), [mutate]);
  return { filter, removeFilter };
}
