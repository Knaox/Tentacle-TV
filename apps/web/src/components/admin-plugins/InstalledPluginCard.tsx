import { memo, useId } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Settings2, ShieldCheck } from "lucide-react";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import { StatusPill } from "../admin/kit";
import { ActionError } from "./ActionError";
import { PluginIcon } from "./PluginIcon";
import { UninstallButton, UpdateButton } from "./PluginActionButtons";
import { ServerModulePill } from "./ServerModulePill";
import { navIconName } from "./pluginCatalog";
import type { PluginActionState } from "./usePluginActions";
import type { InstalledPlugin, MarketplacePlugin, PluginSource } from "./types";

export interface InstalledPluginCardProps {
  plugin: InstalledPlugin;
  /** Son entrée au catalogue : description et image. */
  entry: MarketplacePlugin | undefined;
  source: PluginSource | undefined;
  /** La version à laquelle il peut passer. */
  update: string | null;
  /** Où mène « Configurer » — seulement quand la route existe (plugin actif). */
  configureTo: string | null;
  state: PluginActionState | undefined;
  locked: boolean;
  /** Le serveur redémarre : l'interrupteur attend son retour. */
  restarting: boolean;
  onToggle: (plugin: InstalledPlugin) => void;
  onUpdate: (plugin: InstalledPlugin) => void;
  onUninstall: (plugin: InstalledPlugin) => void;
}

/**
 * Un plugin installé : qui il est (tuile, nom, identifiant, version, source),
 * où il en est (actif, module serveur, mise à jour), et ses gestes — chacun
 * avec son propre état, sous la carte qu'il concerne.
 *
 * Le nom affiché est celui du fichier des plugins installés, que le plugin
 * peut réécrire (Vigie y met le nom d'onglet choisi) : il se tronque, rien
 * n'en dépend.
 */
export const InstalledPluginCard = memo(function InstalledPluginCard({
  plugin, entry, source, update, configureTo, state, locked, restarting, onToggle, onUpdate, onUninstall,
}: InstalledPluginCardProps) {
  const { t, i18n } = useTranslation("adminPlugins");
  const titleId = useId();
  const toggling = state?.kind === "toggle" && state.status === "busy";
  // L'interrupteur bascule dès l'appui ; la liste relue confirme.
  const enabled = toggling ? !plugin.enabled : plugin.enabled;
  const official = source?.official ?? plugin.sourceId === "official";
  const installedOn = formatDate(plugin.installedAt, i18n.language);
  const failed = plugin.serverModule?.state === "failed";

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col rounded-2xl border border-line-subtle bg-fill-faint p-5 transition-colors duration-150 hover:border-line-strong"
    >
      <div className="flex items-start gap-4">
        <PluginIcon name={plugin.name} image={entry?.icon} lucide={navIconName(plugin)} muted={!enabled} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id={titleId} className="truncate text-base font-semibold text-content-primary" title={plugin.name}>
                {plugin.name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-content-tertiary">
                <span className="font-mono">{plugin.pluginId}</span>
                <span aria-hidden> · </span>
                <span className="tabular-nums">v{plugin.version}</span>
                {installedOn && (
                  <>
                    <span aria-hidden> · </span>
                    {t("installedOn", { date: installedOn })}
                  </>
                )}
              </p>
            </div>
            <ToggleSwitch
              checked={enabled}
              onChange={() => onToggle(plugin)}
              label={t("toggleLabel", { name: plugin.name })}
              disabled={toggling || restarting}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusPill tone={enabled ? "success" : "neutral"} size="sm">
              {enabled ? t("stateEnabled") : t("stateDisabled")}
            </StatusPill>
            {update && <StatusPill tone="brand" size="sm">{t("updateAvailable", { version: update })}</StatusPill>}
            <ServerModulePill plugin={plugin} />
            {official ? (
              <StatusPill tone="neutral" size="sm" dot={false}>
                <ShieldCheck aria-hidden size={12} />
                {t("official")}
              </StatusPill>
            ) : source ? (
              <StatusPill tone="neutral" size="sm" dot={false} title={source.url}>
                {source.name}
              </StatusPill>
            ) : null}
          </div>
        </div>
      </div>

      {entry?.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-content-tertiary">{entry.description}</p>}

      {failed && (
        <div className="mt-3 rounded-lg bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
          <p className="font-semibold">{t("serverModuleFailedTitle")}</p>
          {plugin.serverModule?.detail && (
            <p className="mt-0.5 break-words font-mono text-[11px] text-content-secondary">{plugin.serverModule.detail}</p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
        {configureTo && (
          <Link
            to={configureTo}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line-subtle bg-fill-soft px-4 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:border-line-strong hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <Settings2 aria-hidden strokeWidth={2.2} className="h-4 w-4 text-content-secondary" />
            {t("configure")}
          </Link>
        )}
        {update && (
          <UpdateButton
            name={plugin.name}
            version={update}
            restarts={plugin.restartsOn?.update ?? false}
            state={state}
            locked={locked}
            onUpdate={() => onUpdate(plugin)}
          />
        )}
        <div className="ml-auto">
          <UninstallButton
            name={plugin.name}
            restarts={plugin.restartsOn?.uninstall ?? false}
            state={state}
            locked={locked}
            onUninstall={() => onUninstall(plugin)}
          />
        </div>
      </div>

      {state?.status === "error" && <ActionError action={state.kind} error={state.error} className="mt-3" />}
    </article>
  );
});

function formatDate(iso: string, language: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(language, { day: "numeric", month: "short", year: "numeric" });
}
