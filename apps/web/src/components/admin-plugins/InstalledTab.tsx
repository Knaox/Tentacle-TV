import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Puzzle, Store } from "lucide-react";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { EmptyState } from "../ui/EmptyState";
import { AdminNotice } from "../admin/kit";
import { ActionPill } from "../admin/sessions/ActionPill";
import { InstalledPluginCard } from "./InstalledPluginCard";
import { usePluginAdmin } from "./PluginAdminContext";
import { configRoute } from "./pluginCatalog";
import { usePluginOverview } from "./usePluginOverview";
import type { InstalledPlugin } from "./types";

/**
 * Les plugins installés, en cartes. La mise à jour disponible vient du
 * catalogue (rapproché par identifiant) : la liste s'affiche sans l'attendre,
 * les badges arrivent avec lui.
 *
 * La grille suit la largeur RÉELLE du contenu (`auto-fill`, 28rem au moins par
 * carte : de quoi tenir ses trois gestes sur une ligne), pas celle de la
 * fenêtre — la colonne varie avec le rail de l'administration.
 */
export function InstalledTab({ onBrowse }: { onBrowse: () => void }) {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const { installed, sources, catalog, updates } = usePluginOverview();
  const { actions, locked, restarting } = usePluginAdmin();
  const activeMeta = useActivePluginsMeta();

  const sourcesById = useMemo(() => new Map((sources.data ?? []).map((s) => [s.id, s])), [sources.data]);
  // La page d'un plugin n'existe (route enregistrée) que s'il est actif et porte un bundle.
  const routable = useMemo(
    () => new Set(activeMeta.filter((meta) => meta.hasBundle).map((meta) => meta.pluginId)),
    [activeMeta],
  );
  const list = useMemo(
    () => [...(installed.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [installed.data],
  );

  const { toggle, update, uninstall } = actions;
  const onToggle = useCallback((plugin: InstalledPlugin) => void toggle(plugin), [toggle]);
  const onUpdate = useCallback((plugin: InstalledPlugin) => void update(plugin), [update]);
  const onUninstall = useCallback((plugin: InstalledPlugin) => void uninstall(plugin), [uninstall]);

  if (installed.isLoading) {
    return (
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,28rem),1fr))]" aria-busy="true">
        {[0, 1].map((i) => <div key={i} className="skeleton-shimmer h-52 rounded-2xl" />)}
      </div>
    );
  }

  if (installed.isError && !installed.data) {
    return (
      <AdminNotice
        tone="error"
        role="alert"
        title={t("loadInstalledError")}
        action={<ActionPill size="sm" label={t("common:retry")} onClick={() => void installed.refetch()} />}
      />
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Puzzle size={28} aria-hidden />}
        title={t("noPlugins")}
        description={t("noPluginsHint")}
        action={<ActionPill tone="brand" icon={Store} label={t("browseCatalog")} onClick={onBrowse} />}
      />
    );
  }

  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,28rem),1fr))]">
      {list.map((plugin) => (
        <InstalledPluginCard
          key={plugin.id}
          plugin={plugin}
          entry={catalog.get(plugin.pluginId)}
          source={sourcesById.get(plugin.sourceId)}
          update={updates.get(plugin.pluginId) ?? null}
          configureTo={plugin.enabled && routable.has(plugin.pluginId) ? configRoute(plugin) : null}
          state={actions.states.get(plugin.pluginId)}
          locked={locked}
          restarting={restarting}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onUninstall={onUninstall}
        />
      ))}
    </div>
  );
}
