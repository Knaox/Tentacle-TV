import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Globe, ShieldCheck, Trash2 } from "lucide-react";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import { StatusPill } from "../admin/kit";
import { ConfirmButton } from "../admin/sessions/ConfirmButton";
import { ActionError } from "./ActionError";
import { relativeTime } from "./pluginCatalog";
import type { SourceActionState } from "./useSourceActions";
import type { PluginSource } from "./types";

interface SourceRowProps {
  source: PluginSource;
  state: SourceActionState | undefined;
  now: number;
  restarting: boolean;
  onToggle: (source: PluginSource) => void;
  onRemove: (source: PluginSource) => void;
}

/**
 * Une source : son nom, son adresse, et ce que son registre a donné à la
 * dernière lecture — combien de plugins, depuis quand, ou pourquoi il ne
 * répond pas. L'officielle ne se retire pas (le serveur le refuse) ; elle se
 * désactive, comme les autres.
 */
export const SourceRow = memo(function SourceRow({ source, state, now, restarting, onToggle, onRemove }: SourceRowProps) {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const toggling = state?.kind === "toggleSource" && state.status === "busy";
  const enabled = toggling ? !source.enabled : source.enabled;
  const Icon = source.official ? ShieldCheck : Globe;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          source.official ? "bg-[var(--brand-soft)] text-[var(--brand-light)]" : "bg-fill-soft text-content-secondary"
        } ${enabled ? "" : "opacity-60"}`}
      >
        <Icon strokeWidth={2.2} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-content-primary">{source.name}</p>
          {source.official && <StatusPill tone="brand" size="sm" dot={false}>{t("official")}</StatusPill>}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary" title={source.url}>{source.url}</p>
        <SourceStatus source={{ ...source, enabled }} now={now} />
        {state?.status === "error" && <ActionError action={state.kind} error={state.error} className="mt-1.5" />}
      </div>
      <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
        {!source.official && (
          <ConfirmButton
            icon={Trash2}
            label={t("remove")}
            busyLabel={t("removing")}
            title={t("confirmRemoveSource", { name: source.name })}
            body={t("removeSourceBody")}
            confirmLabel={t("remove")}
            cancelLabel={t("common:cancel")}
            status={state?.kind === "removeSource" ? state.status : "idle"}
            onConfirm={() => onRemove(source)}
          />
        )}
        <ToggleSwitch
          checked={enabled}
          onChange={() => onToggle(source)}
          label={t("toggleSourceLabel", { name: source.name })}
          disabled={toggling || restarting}
        />
      </div>
    </li>
  );
});

const TONE = {
  success: { dot: "bg-status-success", text: "text-content-secondary" },
  error: { dot: "bg-status-error", text: "text-status-error-fg" },
  neutral: { dot: "bg-content-quaternary", text: "text-content-tertiary" },
} as const;

/** La dernière lecture du registre, en une ligne. */
function SourceStatus({ source, now }: { source: PluginSource; now: number }) {
  const { t, i18n } = useTranslation("adminPlugins");
  const registry = source.registry;
  const ago = (iso: string) => relativeTime(iso, now, i18n.language) ?? "";

  // Pas d'état de lecture : un serveur d'avant 1.20 n'en rend jamais, un plus
  // récent le rend dès la lecture du catalogue que la page lance à l'ouverture.
  if (source.enabled && !registry) return null;

  let tone: keyof typeof TONE = "neutral";
  let text: string;
  if (!source.enabled || !registry) {
    text = t("sourceDisabled");
  } else if (registry.error) {
    tone = "error";
    text = t("sourceUnreachable", { error: registry.error });
    if (registry.fetchedAt) text += ` · ${t("sourceLastGood", { ago: ago(registry.fetchedAt) })}`;
  } else {
    tone = "success";
    text = `${t("sourcePublishes", { count: registry.pluginCount })} · ${t("sourceReadAgo", { ago: ago(registry.checkedAt) })}`;
  }

  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs">
      <span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TONE[tone].dot}`} />
      <span className={`break-words ${TONE[tone].text}`}>{text}</span>
    </p>
  );
}
