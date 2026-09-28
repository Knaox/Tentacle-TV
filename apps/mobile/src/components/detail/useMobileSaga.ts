import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useExternalCollection, useSagaView } from "@tentacle-tv/api-client";
import { sagaCollectionIdOf, type MediaItem, type SagaView } from "@tentacle-tv/shared";
import { useActivePlugins } from "@/hooks/useActivePlugins";

const NONE: never[] = [];

/**
 * La saga d'un film pour la fiche mobile : le crochet commun (`useSagaView`),
 * nourri des volets manquants que les plugins actifs du mobile savent donner
 * (`search.collection`) — comme au bureau. Aucun plugin : la bibliothèque
 * seule, et pas de rangée pour un film seul de sa saga.
 */
export function useMobileSaga(item: MediaItem): SagaView | null {
  const { t, i18n } = useTranslation("search");
  const lang = (i18n.language || "fr").slice(0, 2);
  const { data: plugins } = useActivePlugins();
  const external = useExternalCollection(sagaCollectionIdOf(item), plugins ?? NONE, { lang, fallbackLabel: t("externalFallback") });
  const sources = useMemo(
    () => external.results.map((result) => ({ pluginId: result.provider.pluginId, items: result.items })),
    [external.results],
  );
  return useSagaView(item, { lang, external: sources }).view;
}
