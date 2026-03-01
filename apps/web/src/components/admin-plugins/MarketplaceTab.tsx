import { useTranslation } from "react-i18next";
import { cls } from "./types";
import { useMarketplacePlugins, useInstallPlugin } from "./hooks";

export function MarketplaceTab() {
  const { t } = useTranslation("adminPlugins");
  const { data: plugins, isLoading, error } = useMarketplacePlugins();
  const installMut = useInstallPlugin();

  if (isLoading) {
    return (
      <div className={cls.spinner}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className={cls.empty}>{t("adminPlugins:fetchError")}</p>;
  }

  if (!plugins || plugins.length === 0) {
    return <p className={cls.empty}>{t("adminPlugins:noMarketplacePlugins")}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plugins.map((p) => (
        <div key={p.pluginId} className={cls.card}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{p.name}</span>
                <span className="text-xs text-white/40">v{p.version}</span>
                {p.official && (
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                    {t("adminPlugins:official")}
                  </span>
                )}
              </div>
            </div>
            {p.installed ? (
              p.updateAvailable ? (
                <button
                  onClick={() => installMut.mutate({ pluginId: p.pluginId, version: p.version, sourceId: p.sourceId })}
                  disabled={installMut.isPending}
                  className={`flex-shrink-0 ${cls.bp}`}
                >
                  {installMut.isPending ? "..." : t("adminPlugins:update")}
                </button>
              ) : (
                <span className="flex-shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/40">
                  {t("adminPlugins:installed")}
                </span>
              )
            ) : (
              <button
                onClick={() => installMut.mutate({ pluginId: p.pluginId, version: p.version, sourceId: p.sourceId })}
                disabled={installMut.isPending}
                className={`flex-shrink-0 ${cls.bp}`}
              >
                {installMut.isPending ? "..." : t("adminPlugins:install")}
              </button>
            )}
          </div>
          <p className="text-xs text-white/50 line-clamp-2">{p.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-white/30">
            <span>{t("adminPlugins:byAuthor", { author: p.author })}</span>
            {p.sourceName && <span>{p.sourceName}</span>}
          </div>
          {p.tags && p.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.tags.map((tag) => (
                <span key={tag} className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/30">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
