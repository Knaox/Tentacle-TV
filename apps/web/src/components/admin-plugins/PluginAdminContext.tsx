import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { useToast } from "../../contexts/ToastContext";
import { PLUGIN_QUERY_ROOT } from "./queries";
import { useRestartTracker, type RestartTracker } from "./useRestartTracker";
import { usePluginActions, type PluginActionKind, type PluginActions } from "./usePluginActions";

interface PluginAdminValue {
  restart: RestartTracker;
  actions: PluginActions;
  /**
   * Aucun geste lourd ne peut partir : un autre est en vol, ou le serveur
   * redémarre. Un redémarrage sort au bout d'une seconde — une installation
   * lancée entre-temps serait coupée net, fichiers à moitié posés.
   */
  locked: boolean;
  /** Le serveur redémarre : rien ne l'atteint, même une bascule. */
  restarting: boolean;
}

const PluginAdminContext = createContext<PluginAdminValue | null>(null);

const SUCCESS_TOAST: Partial<Record<PluginActionKind, string>> = {
  install: "toastInstalled",
  update: "toastUpdated",
  uninstall: "toastUninstalled",
};

/** L'état partagé par les trois onglets : les gestes en cours et le redémarrage du serveur. */
export function PluginAdminProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("adminPlugins");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const refreshPlugins = useRefreshPlugins();

  // Le serveur revenu : tout ce que le redémarrage a pu changer se relit —
  // les listes de la page, et les routes et menus des plugins actifs.
  const onBack = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_ROOT });
    refreshPlugins();
  }, [queryClient, refreshPlugins]);
  const restart = useRestartTracker(onBack);

  const onSuccess = useCallback((kind: PluginActionKind, label: string | null) => {
    const key = SUCCESS_TOAST[kind];
    if (key && label) show("success", t(key, { name: label }));
  }, [show, t]);
  const actions = usePluginActions(restart.begin, onSuccess);

  const restarting = restart.phase.kind === "waiting";
  const locked = actions.heavyBusy || restarting;
  const value = useMemo(() => ({ restart, actions, locked, restarting }), [restart, actions, locked, restarting]);
  return <PluginAdminContext.Provider value={value}>{children}</PluginAdminContext.Provider>;
}

export function usePluginAdmin(): PluginAdminValue {
  const value = useContext(PluginAdminContext);
  if (!value) throw new Error("usePluginAdmin must be used inside PluginAdminProvider");
  return value;
}
