import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink } from "lucide-react";
import type { SetupCheck, SetupPlugin, SetupTask } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { StatusPill, type StatusTone } from "../kit";
import { formatMoment } from "./compatPresentation";
import { splitLibraries } from "./setupPresentation";

/**
 * L'état RÉEL d'un réglage sur le serveur connecté, en une ou deux lignes :
 * les bibliothèques où il est actif et celles où il manque, la valeur en
 * place, les titres sans identifiant TMDB, les greffons et leur état, la
 * tâche planifiée qui fait le travail.
 */

function Line({ tone = "muted", children }: { tone?: "muted" | "warning" | "success"; children: ReactNode }) {
  const color = tone === "warning" ? "text-status-warning-fg" : tone === "success" ? "text-status-success-fg" : "text-content-tertiary";
  return <p className={`text-xs leading-relaxed ${color}`}>{children}</p>;
}

function Libraries({ check, onKey, offKey }: { check: SetupCheck; onKey: string; offKey?: string }) {
  const { t } = useTranslation("adminJellyfin");
  // Non lues (Jellyfin muet sur ce point) : la puce « Inconnu » suffit.
  if (check.libraries === null) return null;
  const { on, off } = splitLibraries(check);
  if (on.length === 0 && off.length === 0) return <Line>{t("noVideoLibrary")}</Line>;
  return (
    <>
      {on.length > 0 && <Line tone={offKey ? "success" : "muted"}>{t(onKey, { names: on.join(" · ") })}</Line>}
      {offKey && off.length > 0 && <Line tone="warning">{t(offKey, { names: off.join(" · ") })}</Line>}
    </>
  );
}

function Task({ task }: { task: SetupTask | null }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  if (!task) return null;
  if (task.state === "running") {
    return <Line>{task.progress === null ? t("taskRunningNoProgress") : t("taskRunning", { progress: task.progress })}</Line>;
  }
  return <Line>{task.lastRunAt ? t("taskLastRun", { date: formatMoment(task.lastRunAt, i18n.language) }) : t("taskNeverRun")}</Line>;
}

const PLUGIN_TONE: Record<SetupPlugin["state"], { tone: StatusTone; key: string }> = {
  active: { tone: "success", key: "pluginActive" },
  restart: { tone: "warning", key: "pluginRestart" },
  disabled: { tone: "neutral", key: "pluginDisabled" },
  missing: { tone: "neutral", key: "pluginMissing" },
};

/** Les greffons de passages : lequel tourne, lequel attend, et comment installer les autres. */
function Plugins({ plugins }: { plugins: SetupPlugin[] }) {
  const { t } = useTranslation("adminJellyfin");
  const { show } = useToast();
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      show("success", t("repositoryCopied"));
    } catch {
      show("info", url);
    }
  };
  return (
    <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
      {plugins.map((plugin) => (
        <li key={plugin.name} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-fill-subtle px-2.5 py-1.5">
          <a
            href={plugin.homepage ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-content-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <span className="truncate">{plugin.name}</span>
            <ExternalLink size={11} aria-hidden="true" className="flex-shrink-0 text-content-quaternary" />
            <span className="sr-only"> {t("opensNewTab")}</span>
          </a>
          <StatusPill tone={PLUGIN_TONE[plugin.state].tone} size="sm">{t(PLUGIN_TONE[plugin.state].key)}</StatusPill>
          {plugin.official && plugin.state === "missing" && (
            <span className="text-[11px] text-content-tertiary">{t("pluginOfficial")}</span>
          )}
          {!plugin.official && plugin.state === "missing" && plugin.repositoryUrl && (
            <button
              type="button"
              onClick={() => void copy(plugin.repositoryUrl as string)}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-content-secondary hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <Copy size={12} aria-hidden="true" />
              {t("copyRepository")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SetupCheckDetails({ check }: { check: SetupCheck }) {
  const { t } = useTranslation("adminJellyfin");
  switch (check.id) {
    case "metadataTmdb": {
      const excluded = splitLibraries(check).off;
      return (
        <>
          {check.state === "todo" && excluded.length === 0 && <Line tone="warning">{t("tmdbPluginOff")}</Line>}
          {excluded.length > 0 && <Line tone="warning">{t("tmdbExcluded", { names: excluded.join(" · ") })}</Line>}
          {check.missingTmdb !== null && (
            check.missingTmdb > 0
              ? <Line tone="warning">{t("tmdbMissing", { count: check.missingTmdb })}</Line>
              : <Line tone="success">{t("tmdbAllMatched")}</Line>
          )}
        </>
      );
    }
    case "metadataLanguage":
      return <Line>{check.current ? t("languageCurrent", { value: check.current }) : t("languageMissing")}</Line>;
    case "trickplay":
      return (
        <>
          <Libraries check={check} onKey="librariesOn" offKey="librariesOff" />
          <Task task={check.task} />
        </>
      );
    case "segmentsProvider":
      return (
        <>
          {check.plugins && <Plugins plugins={check.plugins} />}
          <Task task={check.task} />
        </>
      );
    case "realtimeMonitor":
      return <Libraries check={check} onKey="librariesOn" offKey="librariesOff" />;
    case "hardwareAcceleration":
      return <Line>{check.current && check.current.toLowerCase() !== "none" ? t("hardwareCurrent", { value: check.current }) : t("hardwareNone")}</Line>;
    case "chapterImages": {
      const on = splitLibraries(check).on;
      return <Line>{on.length > 0 ? t("chaptersOn", { names: on.join(" · ") }) : t("chaptersOff")}</Line>;
    }
    default:
      return null;
  }
}
