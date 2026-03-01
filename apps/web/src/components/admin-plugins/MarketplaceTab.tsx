import { cls } from "./types";
import { useMarketplacePlugins, useInstallPlugin } from "./hooks";

export function MarketplaceTab() {
  const { data: plugins, isLoading } = useMarketplacePlugins();
  const installMut = useInstallPlugin();

  if (isLoading) {
    return (
      <div className={cls.spinner}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!plugins || plugins.length === 0) {
    return <p className={cls.empty}>Aucun plugin disponible dans les sources configurees</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plugins.map((p) => (
        <div key={p.id} className={cls.card}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-white">{p.name}</span>
              <span className="ml-2 text-xs text-white/40">v{p.version}</span>
            </div>
            {p.installed ? (
              <span className="flex-shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/40">
                Installe
              </span>
            ) : (
              <button
                onClick={() => installMut.mutate({ pluginId: p.id })}
                disabled={installMut.isPending}
                className={`flex-shrink-0 ${cls.bp}`}
              >
                {installMut.isPending ? "..." : "Installer"}
              </button>
            )}
          </div>
          <p className="text-xs text-white/50 line-clamp-2">{p.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-white/30">
            <span>{p.author}</span>
            {p.downloads > 0 && <span>{p.downloads.toLocaleString()} telechargements</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
