import { cls } from "./types";
import { useInstalledPlugins, useTogglePlugin, useUninstallPlugin } from "./hooks";

export function InstalledTab() {
  const { data: plugins, isLoading } = useInstalledPlugins();
  const toggleMut = useTogglePlugin();
  const uninstallMut = useUninstallPlugin();

  if (isLoading) {
    return (
      <div className={cls.spinner}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!plugins || plugins.length === 0) {
    return <p className={cls.empty}>Aucun plugin installe</p>;
  }

  return (
    <div className="space-y-3">
      {plugins.map((p) => (
        <div key={p.id} className={cls.row}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{p.name}</span>
              <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/40">
                v{p.version}
              </span>
              {p.hasUpdate && p.latestVersion && (
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                  v{p.latestVersion} disponible
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-white/50 truncate">{p.description}</p>
            <p className="mt-0.5 text-xs text-white/30">par {p.author}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Toggle */}
            <button
              onClick={() => toggleMut.mutate(p.id)}
              disabled={toggleMut.isPending}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                p.enabled ? "bg-purple-600" : "bg-white/10"
              }`}
              title={p.enabled ? "Desactiver" : "Activer"}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  p.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>

            {/* Configure */}
            <button className={cls.bs}>Configurer</button>

            {/* Update */}
            {p.hasUpdate && (
              <button className={cls.bp}>Mettre a jour</button>
            )}

            {/* Uninstall */}
            <button
              onClick={() => {
                if (confirm(`Desinstaller ${p.name} ?`)) {
                  uninstallMut.mutate(p.id);
                }
              }}
              disabled={uninstallMut.isPending}
              className={cls.bd}
            >
              Desinstaller
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
