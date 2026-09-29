import { useTranslation } from "react-i18next";
import { AdminSection } from "../kit";
import { PluginAdminProvider } from "../../admin-plugins/PluginAdminContext";
import { ServerRestartPanel } from "../../admin-plugins/ServerRestartPanel";
import { useInstalledPlugins } from "../../admin-plugins/queries";
import { RecommendedPluginCard } from "./RecommendedPluginCard";
import { RECOMMENDED_PLUGINS } from "./recommendedPlugins";

/**
 * Les extensions que la vue d'ensemble recommande. Le même moteur que la page
 * Plugins — ses gestes, son suivi du redémarrage que charge un module serveur
 * — pour qu'« Installer » ici soit exactement l'installation du catalogue.
 */
export function RecommendedPluginsSection() {
  return (
    <PluginAdminProvider>
      <Recommended />
    </PluginAdminProvider>
  );
}

function Recommended() {
  const { t } = useTranslation("adminRecommended");
  const installed = useInstalledPlugins();
  return (
    <AdminSection title={t("title")} description={t("description")}>
      <div className="space-y-3">
        <ServerRestartPanel installed={installed.data} />
        {RECOMMENDED_PLUGINS.map((rec) => (
          <RecommendedPluginCard key={rec.pluginId} rec={rec} />
        ))}
      </div>
    </AdminSection>
  );
}
