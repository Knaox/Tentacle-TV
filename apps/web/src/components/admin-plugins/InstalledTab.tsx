import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { cls } from "./types";
import { useInstalledPlugins, useTogglePlugin, useUninstallPlugin, useUpdatePlugin } from "./hooks";

export function InstalledTab() {
  const { t } = useTranslation("adminPlugins");
  const navigate = useNavigate();
  const { data: plugins, isLoading } = useInstalledPlugins();
  const pluginConfigRoutes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of plugins || []) {
      const adminNav = (p.navItems || []).find(
        (nav) => nav.admin && nav.platforms?.includes("web")
      );
      if (adminNav) {
        map[p.pluginId] = adminNav.path;
      } else if (p.hasBundle) {
        map[p.pluginId] = `/admin/plugins/${p.pluginId}`;
      }
    }
    return map;
  }, [plugins]);
  const toggleMut = useTogglePlugin();
  const uninstallMut = useUninstallPlugin();
  const updateMut = useUpdatePlugin();

  if (isLoading) {
    return (
      <div className={cls.spinner}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!plugins || plugins.length === 0) {
    return <p className={cls.empty}>{t("adminPlugins:noPlugins")}</p>;
  }

  return (
    <div className="space-y-3">
      {plugins.map((p) => (
        <div key={p.id} className={cls.row}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {/* Health indicator */}
              <span
                className={`h-2 w-2 rounded-full ${p.enabled ? "bg-green-500" : "bg-white/20"}`}
                title={p.enabled ? t("adminPlugins:enable") : t("adminPlugins:disable")}
              />
              <span className="text-sm font-medium text-white">{p.name}</span>
              <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/40">
                v{p.version}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/30">
              {new Date(p.installedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Toggle */}
            <button
              onClick={() => toggleMut.mutate(p.id)}
              disabled={toggleMut.isPending}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                p.enabled ? "bg-purple-600" : "bg-white/10"
              }`}
              title={p.enabled ? t("adminPlugins:disable") : t("adminPlugins:enable")}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  p.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>

            {/* Configure */}
            {pluginConfigRoutes[p.pluginId] && (
              <button
                onClick={() => navigate(pluginConfigRoutes[p.pluginId])}
                className={cls.bs}
              >
                {t("adminPlugins:configure")}
              </button>
            )}

            {/* Update */}
            <button
              onClick={() => updateMut.mutate(p.id)}
              disabled={updateMut.isPending}
              className={cls.bs}
            >
              {updateMut.isPending ? "..." : t("adminPlugins:update")}
            </button>

            {/* Uninstall */}
            <button
              onClick={() => {
                if (confirm(t("adminPlugins:confirmUninstall", { name: p.name }))) {
                  uninstallMut.mutate({ id: p.id, pluginId: p.pluginId });
                }
              }}
              disabled={uninstallMut.isPending}
              className={cls.bd}
            >
              {t("adminPlugins:uninstall")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
