import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { ActionPill, type PillStatus } from "../admin/sessions/ActionPill";
import { useErrorText } from "./ActionError";
import { pluginApi } from "./pluginApi";
import { describePluginError } from "./pluginErrors";
import { usePluginAdmin } from "./PluginAdminContext";
import { PLUGIN_QUERY_ROOT } from "./queries";
import type { RefreshResult } from "./types";

/** Le temps de lire la coche, ou l'alerte. */
const FEEDBACK_MS = 2500;

/**
 * Relire tout de suite les registres de toutes les sources actives — le
 * serveur les garde six heures. C'est « Rechercher des mises à jour » : placé
 * en tête de page, il sert aux trois onglets. Le résultat, que l'ancienne page
 * ignorait, s'annonce : combien de plugins publiés, et les sources muettes.
 */
export function RefreshCatalogButton() {
  const { t } = useTranslation("adminPlugins");
  const { show } = useToast();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const { restart } = usePluginAdmin();
  const [status, setStatus] = useState<PillStatus>("idle");
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(reset.current), []);

  const settle = (next: PillStatus) => {
    setStatus(next);
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setStatus("idle"), FEEDBACK_MS);
  };

  const refresh = async () => {
    setStatus("busy");
    try {
      const result = await pluginApi<RefreshResult>("/sources/refresh", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_ROOT });
      const summary = t("refreshDone", { count: result.plugins, sources: result.refreshed });
      const failed = result.failed ?? 0;
      show(failed > 0 ? "info" : "success", failed > 0 ? `${summary} ${t("refreshFailedSources", { count: failed })}` : summary);
      settle("done");
    } catch (error) {
      show("error", errorText("refresh", describePluginError(error)));
      settle("error");
    }
  };

  return (
    <ActionPill
      icon={RefreshCw}
      label={t("refreshCatalog")}
      busyLabel={t("refreshing")}
      doneLabel={t("refreshed")}
      status={status}
      title={t("refreshCatalogHint")}
      disabled={restart.phase.kind === "waiting"}
      onClick={() => void refresh()}
    />
  );
}
