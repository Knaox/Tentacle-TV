import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { AdminNotice, AdminSection } from "../admin/kit";
import { ActionPill } from "../admin/sessions/ActionPill";
import { AddSourceSheet } from "./AddSourceSheet";
import { SourceRow } from "./SourceRow";
import { usePluginOverview } from "./usePluginOverview";
import { useSourceActions } from "./useSourceActions";
import type { PluginSource } from "./types";

/**
 * Les sources des plugins : l'officielle, et les registres tiers ajoutés à la
 * main. Chacune dit ce que son registre a donné à la dernière lecture ;
 * « Actualiser le catalogue », en tête de page, les relit toutes.
 */
export function SourcesTab() {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const { show } = useToast();
  const { sources } = usePluginOverview();
  const actions = useSourceActions();
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const now = Date.now();

  const { toggle, remove } = actions;
  const onToggle = useCallback((source: PluginSource) => void toggle(source), [toggle]);
  const onRemove = useCallback((source: PluginSource) => {
    void remove(source).then((done) => {
      if (done) show("success", t("sourceRemoved", { name: source.name }));
    });
  }, [remove, show, t]);

  const closeSheet = useCallback(() => {
    setAdding(false);
    addButton.current?.focus({ preventScroll: true });
  }, []);

  const onAdded = useCallback((source: PluginSource) => {
    closeSheet();
    const registry = source.registry;
    if (registry?.error) show("info", t("sourceAddedUnreachable", { name: source.name, error: registry.error }));
    else show("success", t("sourceAdded", { name: source.name, count: registry?.pluginCount ?? 0 }));
  }, [closeSheet, show, t]);

  if (sources.isLoading) {
    return <div className="skeleton-shimmer h-48 rounded-2xl" aria-busy="true" />;
  }
  if (sources.isError && !sources.data) {
    return (
      <AdminNotice
        tone="error"
        role="alert"
        title={t("loadSourcesError")}
        action={<ActionPill size="sm" label={t("common:retry")} onClick={() => void sources.refetch()} />}
      />
    );
  }

  const list = sources.data ?? [];
  return (
    <>
      <AdminSection
        title={t("sourcesTitle")}
        description={t("sourcesDescription")}
        actions={<ActionPill ref={addButton} tone="brand" icon={Plus} label={t("addSource")} onClick={() => setAdding(true)} />}
        flush
      >
        {list.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-content-tertiary">{t("noSources")}</p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {list.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                state={actions.states.get(source.id)}
                now={now}
                onToggle={onToggle}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </AdminSection>
      <AddSourceSheet open={adding} onClose={closeSheet} onSubmit={actions.add} onAdded={onAdded} />
    </>
  );
}
