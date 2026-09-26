import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AdminPage, StatusPill, TabPanel, Tabs, useUrlTab, type StatusTone } from "../components/admin/kit";
import { InstalledTab } from "../components/admin-plugins/InstalledTab";
import { MarketplaceTab } from "../components/admin-plugins/MarketplaceTab";
import type { CatalogFilter } from "../components/admin-plugins/MarketplaceToolbar";
import { SourcesTab } from "../components/admin-plugins/SourcesTab";
import { PluginAdminProvider } from "../components/admin-plugins/PluginAdminContext";
import { RefreshCatalogButton } from "../components/admin-plugins/RefreshCatalogButton";
import { ServerRestartPanel } from "../components/admin-plugins/ServerRestartPanel";
import { pluginKeys } from "../components/admin-plugins/queries";
import { usePluginOverview } from "../components/admin-plugins/usePluginOverview";

const TABS = ["installed", "marketplace", "sources"] as const;

/**
 * L'administration des plugins : ceux qui sont installés, le catalogue que
 * publient les sources, et les sources elles-mêmes — trois onglets gardés
 * dans l'adresse (`?tab=`). Au-dessus, le redémarrage du serveur quand un
 * module serveur en impose un, suivi jusqu'à son retour.
 */
export function AdminPlugins() {
  return (
    <PluginAdminProvider>
      <AdminPluginsPage />
    </PluginAdminProvider>
  );
}

function AdminPluginsPage() {
  const { t } = useTranslation("adminPlugins");
  const idPrefix = useId();
  const [tab, setTab] = useUrlTab(TABS);
  const queryClient = useQueryClient();
  const { installed, marketplace, sources, updates, unreachable } = usePluginOverview();
  // La recherche du catalogue survit à un passage par un autre onglet.
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>({ query: "", category: null });

  // L'état de lecture d'une source naît de la lecture du catalogue : le
  // catalogue arrivé, la liste des sources se relit pour le montrer.
  const catalogReadAt = marketplace.dataUpdatedAt;
  useEffect(() => {
    if (catalogReadAt) void queryClient.invalidateQueries({ queryKey: pluginKeys.sources });
  }, [catalogReadAt, queryClient]);

  const summary = updates.size > 0 || unreachable.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {updates.size > 0 && (
        <SummaryLink tone="brand" onClick={() => setTab("installed")}>
          {t("summaryUpdates", { count: updates.size })}
        </SummaryLink>
      )}
      {unreachable.length > 0 && (
        <SummaryLink tone="warning" onClick={() => setTab("sources")}>
          {t("summaryUnreachable", { count: unreachable.length })}
        </SummaryLink>
      )}
    </div>
  ) : undefined;

  return (
    <AdminPage title={t("pageTitle")} description={t("subtitle")} actions={<RefreshCatalogButton />} summary={summary}>
      <ServerRestartPanel installed={installed.data} />
      <div>
        <Tabs
          idPrefix={idPrefix}
          label={t("pageTitle")}
          items={[
            { id: "installed", label: t("tabInstalled"), count: installed.data?.length },
            { id: "marketplace", label: t("tabMarketplace"), count: marketplace.data?.length },
            { id: "sources", label: t("tabSources"), count: sources.data?.length },
          ]}
          active={tab}
          onChange={setTab}
          className="mb-4"
        />
        <TabPanel idPrefix={idPrefix} id="installed" active={tab === "installed"}>
          <InstalledTab onBrowse={() => setTab("marketplace")} />
        </TabPanel>
        <TabPanel idPrefix={idPrefix} id="marketplace" active={tab === "marketplace"}>
          <MarketplaceTab filter={catalogFilter} onFilter={setCatalogFilter} onShowSources={() => setTab("sources")} />
        </TabPanel>
        <TabPanel idPrefix={idPrefix} id="sources" active={tab === "sources"}>
          <SourcesTab />
        </TabPanel>
      </div>
    </AdminPage>
  );
}

/** Une puce du résumé qui mène à l'onglet où l'on agit. */
function SummaryLink({ tone, onClick, children }: { tone: StatusTone; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full outline-none transition-transform duration-150 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <StatusPill tone={tone}>{children}</StatusPill>
    </button>
  );
}
