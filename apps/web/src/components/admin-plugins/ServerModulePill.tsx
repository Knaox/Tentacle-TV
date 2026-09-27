import { useTranslation } from "react-i18next";
import { StatusPill } from "../admin/kit";
import type { InstalledPlugin } from "./types";

/**
 * Le module serveur d'un plugin, en une puce : il tourne, il est arrêté, il a
 * échoué — ou il attend un redémarrage pour suivre l'activation. Rien pour un
 * plugin sans module serveur, ni face à un serveur d'avant 1.19.3 (qui ne le dit
 * pas : l'interface ne devine pas).
 */
export function ServerModulePill({ plugin }: { plugin: InstalledPlugin }) {
  const { t } = useTranslation("adminPlugins");
  const state = plugin.serverModule?.state;
  if (!state || state === "none") return null;
  if (state === "failed") {
    return <StatusPill tone="error" size="sm" title={t("serverModuleHint")}>{t("serverModuleFailed")}</StatusPill>;
  }
  if (plugin.restartRequired) {
    return (
      <StatusPill tone="warning" size="sm" title={t("restartRequiredHint")}>
        {plugin.enabled ? t("serverModuleStartsOnRestart") : t("serverModuleStopsOnRestart")}
      </StatusPill>
    );
  }
  return (
    <StatusPill tone={state === "running" ? "info" : "neutral"} size="sm" title={t("serverModuleHint")}>
      {state === "running" ? t("serverModuleRunning") : t("serverModuleIdle")}
    </StatusPill>
  );
}
