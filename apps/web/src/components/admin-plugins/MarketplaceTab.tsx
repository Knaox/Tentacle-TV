import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SearchX, Store } from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import { AdminNotice } from "../admin/kit";
import { ActionPill } from "../admin/sessions/ActionPill";
import { MarketplaceCard } from "./MarketplaceCard";
import { MarketplaceToolbar, type CatalogFilter } from "./MarketplaceToolbar";
import { PluginDetailSheet } from "./PluginDetailSheet";
import { usePluginAdmin } from "./PluginAdminContext";
import { catalogCategories, searchCatalog, sortCatalog } from "./pluginCatalog";
import { usePluginOverview } from "./usePluginOverview";

const GRID = "grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]";

interface MarketplaceTabProps {
  filter: CatalogFilter;
  onFilter: (filter: CatalogFilter) => void;
  onShowSources: () => void;
}

/**
 * Le catalogue des sources actives : chercher, filtrer par catégorie,
 * installer d'un geste, ouvrir la fiche d'un plugin (`?plugin=<id>` — un lien
 * y mène directement, le retour du navigateur la ferme). La recherche vit dans
 * la page : elle survit à un passage par un autre onglet.
 */
export function MarketplaceTab({ filter, onFilter, onShowSources }: MarketplaceTabProps) {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const { marketplace, installed, sources, updates, unreachable } = usePluginOverview();
  const { actions } = usePluginAdmin();
  const [params, setParams] = useSearchParams();

  const installedById = useMemo(() => new Map((installed.data ?? []).map((p) => [p.pluginId, p])), [installed.data]);
  const catalog = useMemo(() => sortCatalog(marketplace.data ?? []), [marketplace.data]);
  const categories = useMemo(() => catalogCategories(catalog), [catalog]);
  const shown = useMemo(() => {
    const inCategory = filter.category ? catalog.filter((entry) => entry.category === filter.category) : catalog;
    return searchCatalog(inCategory, filter.query);
  }, [catalog, filter]);

  // Le bouton qui a ouvert la fiche reprend le focus à sa fermeture, au lieu
  // de le laisser tomber sur la page.
  const detailsOpener = useRef<HTMLElement | null>(null);
  const openDetails = useCallback((pluginId: string, opener?: HTMLElement) => {
    detailsOpener.current = opener ?? null;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("plugin", pluginId);
      return next;
    });
  }, [setParams]);
  const closeDetails = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("plugin");
      return next;
    }, { replace: true });
    detailsOpener.current?.focus({ preventScroll: true });
    detailsOpener.current = null;
  }, [setParams]);

  const selectedId = params.get("plugin");
  const selected = selectedId ? catalog.find((entry) => entry.pluginId === selectedId) : undefined;
  const noActiveSource = sources.data !== undefined && !sources.data.some((source) => source.enabled);

  if (marketplace.isLoading) {
    return (
      <div className={GRID} aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton-shimmer h-64 rounded-2xl" />)}
      </div>
    );
  }
  if (marketplace.isError && !marketplace.data) {
    return (
      <AdminNotice
        tone="error"
        role="alert"
        title={t("fetchError")}
        action={<ActionPill size="sm" label={t("common:retry")} onClick={() => void marketplace.refetch()} />}
      />
    );
  }
  if (noActiveSource || catalog.length === 0) {
    return (
      <EmptyState
        icon={<Store size={28} aria-hidden />}
        title={noActiveSource ? t("noActiveSource") : t("noMarketplacePlugins")}
        description={noActiveSource ? t("noActiveSourceHint") : t("noMarketplacePluginsHint")}
        action={<ActionPill tone="brand" label={t("manageSources")} onClick={onShowSources} />}
      />
    );
  }

  return (
    <>
      {unreachable.length > 0 && (
        <AdminNotice
          tone="warning"
          className="mb-4"
          title={t("unreachableTitle", { count: unreachable.length })}
          action={<ActionPill size="sm" label={t("manageSources")} onClick={onShowSources} />}
        >
          {t("unreachableBody", {
            count: unreachable.length,
            names: unreachable.map((source) => t("quoted", { text: source.name })).join(", "),
          })}
        </AdminNotice>
      )}

      <MarketplaceToolbar filter={filter} onFilter={onFilter} categories={categories} total={catalog.length} shown={shown.length} />

      {shown.length === 0 ? (
        <EmptyState
          icon={<SearchX size={28} aria-hidden />}
          title={filter.query.trim() ? t("noResultsFor", { query: filter.query.trim() }) : t("noResults")}
          action={<ActionPill label={t("clearFilters")} onClick={() => onFilter({ query: "", category: null })} />}
        />
      ) : (
        <div className={GRID}>
          {shown.map((entry) => (
            <MarketplaceCard
              key={entry.pluginId}
              entry={entry}
              installed={installedById.get(entry.pluginId)}
              update={updates.get(entry.pluginId) ?? null}
              state={actions.states.get(entry.pluginId)}
              onDetails={openDetails}
            />
          ))}
        </div>
      )}

      <PluginDetailSheet
        entry={selected}
        installed={selected ? installedById.get(selected.pluginId) : undefined}
        update={selected ? updates.get(selected.pluginId) ?? null : null}
        onClose={closeDetails}
      />
    </>
  );
}
