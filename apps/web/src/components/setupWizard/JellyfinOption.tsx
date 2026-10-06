import { useTranslation } from "react-i18next";
import type { JellyfinProbeResult } from "@tentacle-tv/shared";
import { hostAndPort, serverState } from "./jellyfinChoice";

const BADGE = {
  blank: "bg-status-success-bg text-status-success-fg",
  configured: "bg-fill-faint text-content-secondary",
  incompatible: "bg-status-error-bg text-status-error-fg",
} as const;

/** Une ligne de la liste : un vrai bouton radio, l'adresse, le port, le nom, la version, et l'état en toutes lettres. */
export function JellyfinOption({ server, name, checked, onSelect }: { server: JellyfinProbeResult; name: string; checked: boolean; onSelect: () => void }) {
  const { t } = useTranslation("setupWizard");
  const state = serverState(server);
  const { host, port } = hostAndPort(server.url);
  const disabled = state === "incompatible";
  return (
    <label
      className={`flex min-h-14 items-start gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ${
        checked ? "border-purple-400/50 bg-purple-500/10" : "border-line-subtle hover:bg-fill-faint"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input type="radio" name={name} value={server.url} checked={checked} disabled={disabled} onChange={onSelect} className="mt-1 h-4 w-4 shrink-0 accent-purple-400" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-content-primary">{server.serverName || t("jfUnnamed")}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[state]}`}>{t(`jfState_${state}`)}</span>
        </span>
        <span className="mt-0.5 block break-all text-sm text-content-secondary">
          {t("jfOptionLine", { host, port, version: server.version })}
        </span>
      </span>
    </label>
  );
}
