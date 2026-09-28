/**
 * La saga d'un film pour la fiche du web (bureau, miroir, LG) : le crochet
 * commun (`useSagaView`, api-client), nourri des volets manquants que les
 * plugins actifs savent donner (`search.collection`). Sur la LG, le shim des
 * plugins n'en déclare aucun : la rangée n'y montre que la bibliothèque.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { useExternalCollection, useSagaView } from "@tentacle-tv/api-client";
import { sagaCollectionIdOf, type MediaItem, type SagaView } from "@tentacle-tv/shared";

export function useDetailSaga(item: MediaItem): SagaView | null {
  const { t, i18n } = useTranslation("search");
  const lang = (i18n.language || "fr").slice(0, 2);
  const plugins = useActivePluginsMeta();
  const external = useExternalCollection(sagaCollectionIdOf(item), plugins, { lang, fallbackLabel: t("externalFallback") });
  const sources = useMemo(
    () => external.results.map((result) => ({ pluginId: result.provider.pluginId, items: result.items })),
    [external.results],
  );
  return useSagaView(item, { lang, external: sources }).view;
}
