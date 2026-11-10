import { useTranslation } from "react-i18next";
import { StackIcon as Boxes } from "@phosphor-icons/react/dist/csr/Stack";
import { SparkleIcon as Sparkles } from "@phosphor-icons/react/dist/csr/Sparkle";
import type { JellyfinProbeResult } from "@tentacle-tv/shared";
import { hostAndPort, serverState } from "./jellyfinChoice";

const BADGE = {
  blank: "chip-success",
  configured: "bg-status-info-bg text-status-info-fg",
  incompatible: "chip-danger",
} as const;

/**
 * Une ligne de la liste — une tuile, la retenue au fond et au trait de la
 * teinte franche : un vrai bouton radio, le nom, l'état en toutes
 * lettres (jamais la couleur seule), « dans cette pile » et « Conseillé »
 * s'il y a lieu, puis l'adresse, le port et la version.
 */
export function JellyfinOption({
  server,
  name,
  checked,
  recommended,
  onSelect,
}: {
  server: JellyfinProbeResult;
  name: string;
  checked: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation("setupWizard");
  const state = serverState(server);
  const { host, port } = hostAndPort(server.url);
  const disabled = state === "incompatible";
  return (
    <label
      className={`flex min-h-14 items-start gap-3 rounded-tile px-4 py-3 transition-colors duration-hover ${
        checked ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : disabled ? "bg-surface-2" : "bg-surface-2 hover:bg-surface-3"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input type="radio" name={name} value={server.url} checked={checked} disabled={disabled} onChange={onSelect} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-content-primary">{server.serverName || t("jfUnnamed")}</span>
          <span className={`chip ${BADGE[state]}`}>{t(`jfState_${state}`)}</span>
          {recommended ? (
            <span className="chip chip-accent">
              <Sparkles size={12} weight="bold" aria-hidden="true" />
              {t("jfRecommended")}
            </span>
          ) : null}
          {server.inStack ? (
            <span className="chip">
              <Boxes size={12} weight="bold" aria-hidden="true" />
              {t("jfInStack")}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block break-all text-sm text-content-secondary">
          {t("jfOptionLine", { host, port, version: server.version })}
        </span>
      </span>
    </label>
  );
}
