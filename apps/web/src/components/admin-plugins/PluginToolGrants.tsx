import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import { pluginApi } from "./pluginApi";
import { PLUGIN_QUERY_ROOT } from "./queries";
import type { InstalledPlugin } from "./types";

/**
 * Les OUTILS du serveur qu'une extension isolée demande (yt-dlp…), un
 * interrupteur chacun : fermé tant que l'administrateur ne l'a pas permis
 * (liste blanche du runtime, serveur 1.32.0). Un serveur d'avant n'envoie pas
 * `runtimeTools` : rien ne s'affiche.
 */
export const PluginToolGrants = memo(function PluginToolGrants({ plugin }: { plugin: InstalledPlugin }) {
  const tools = plugin.runtimeTools ?? [];
  const { t } = useTranslation("adminPlugins");
  const titleId = useId();
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="mt-3 rounded-lg border border-line-subtle bg-fill-soft px-3 py-2.5">
      <h4 id={titleId} className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{t("toolGrantTitle")}</h4>
      <ul className="mt-2 flex flex-col gap-3">
        {tools.map((entry) => (
          <ToolGrantRow key={entry.tool} pluginId={plugin.id} tool={entry.tool} granted={entry.granted} />
        ))}
      </ul>
    </section>
  );
});

function ToolGrantRow({ pluginId, tool, granted }: { pluginId: string; tool: string; granted: boolean }) {
  const { t } = useTranslation("adminPlugins");
  const queryClient = useQueryClient();
  const hintId = useId();
  const [saving, setSaving] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  // L'interrupteur suit le geste tout de suite ; la liste relue confirme.
  const checked = saving ?? granted;

  const change = async (allowed: boolean) => {
    setSaving(allowed);
    setFailed(false);
    try {
      await pluginApi(`/${encodeURIComponent(pluginId)}/tools/${encodeURIComponent(tool)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed }),
      });
      await queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_ROOT });
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  };

  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content-primary">{t("toolGrantLabel", { tool })}</p>
          <p id={hintId} className="mt-0.5 text-xs leading-relaxed text-content-tertiary">{t("toolGrantHint", { tool })}</p>
        </div>
        <span aria-describedby={hintId} className="pt-0.5">
          <ToggleSwitch checked={checked} onChange={(next) => void change(next)} label={t("toolGrantLabel", { tool })} disabled={saving !== null} />
        </span>
      </div>
      {failed && (
        <p role="alert" className="mt-1.5 text-xs text-status-error-fg">{t("toolGrantError")}</p>
      )}
    </li>
  );
}
