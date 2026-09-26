import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { Info, ShieldCheck } from "lucide-react";
import { StatusPill } from "../admin/kit";
import { ActionPill } from "../admin/sessions/ActionPill";
import { ActionError } from "./ActionError";
import { CatalogEntryAction } from "./CatalogEntryAction";
import { useCategoryLabel } from "./MarketplaceToolbar";
import { PluginIcon } from "./PluginIcon";
import { navIconName } from "./pluginCatalog";
import type { PluginActionState } from "./usePluginActions";
import type { InstalledPlugin, MarketplacePlugin } from "./types";

/** Au-delà, les mots-clés se résument : « +2 ». */
const VISIBLE_TAGS = 3;

interface MarketplaceCardProps {
  entry: MarketplacePlugin;
  installed: InstalledPlugin | undefined;
  update: string | null;
  state: PluginActionState | undefined;
  onDetails: (pluginId: string, opener: HTMLElement) => void;
}

/**
 * Une entrée du catalogue : qui la publie (officielle, ou le nom de la source
 * tierce), où elle en est chez vous (installée, à mettre à jour), ce qu'elle
 * fait, et le geste qui va avec. « Détails » ouvre la fiche : description
 * entière, notes de version, dépôt.
 */
export const MarketplaceCard = memo(function MarketplaceCard({ entry, installed, update, state, onDetails }: MarketplaceCardProps) {
  const { t } = useTranslation("adminPlugins");
  const categoryLabel = useCategoryLabel();
  const titleId = useId();
  const tags = entry.tags ?? [];

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col rounded-2xl border border-line-subtle bg-fill-faint p-5 transition-colors duration-150 hover:border-line-strong"
    >
      <div className="flex items-start gap-4">
        <PluginIcon name={entry.name} image={entry.icon} lucide={installed ? navIconName(installed) : null} />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="truncate text-base font-semibold text-content-primary" title={entry.name}>
            {entry.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-content-tertiary">
            {entry.author ? t("byAuthor", { author: entry.author }) : <span className="font-mono">{entry.pluginId}</span>}
            <span aria-hidden> · </span>
            <span className="tabular-nums">v{entry.version}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.official ? (
          <StatusPill tone="brand" size="sm" dot={false}>
            <ShieldCheck aria-hidden size={12} />
            {t("official")}
          </StatusPill>
        ) : (
          <StatusPill tone="neutral" size="sm" dot={false} title={t("thirdPartyHint")}>
            {entry.sourceName}
          </StatusPill>
        )}
        {installed && (
          <StatusPill tone={update ? "brand" : "success"} size="sm">
            {update ? t("updateAvailable", { version: update }) : t("installed")}
          </StatusPill>
        )}
        {entry.category && (
          <StatusPill tone="neutral" size="sm" dot={false}>{categoryLabel(entry.category)}</StatusPill>
        )}
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-content-tertiary">
        {entry.description || t("noDescription")}
      </p>

      {tags.length > 0 && (
        <p className="mt-2 truncate text-xs text-content-quaternary">
          {tags.slice(0, VISIBLE_TAGS).map((tag) => `#${tag}`).join("  ")}
          {tags.length > VISIBLE_TAGS && `  +${tags.length - VISIBLE_TAGS}`}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-line-subtle pt-4">
        <CatalogEntryAction entry={entry} installed={installed} update={update} />
        <ActionPill
          className="ml-auto"
          icon={Info}
          label={t("details")}
          aria-label={t("detailsFor", { name: entry.name })}
          onClick={(event) => onDetails(entry.pluginId, event.currentTarget)}
        />
      </div>

      {state?.status === "error" && <ActionError action={state.kind} error={state.error} className="mt-3" />}
    </article>
  );
});
