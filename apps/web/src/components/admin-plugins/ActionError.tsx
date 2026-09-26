import { useTranslation } from "react-i18next";
import type { PluginErrorDescription, PluginErrorReason } from "./pluginErrors";

/** Ce qui a échoué — la première moitié de la phrase. */
export type FailedAction =
  | "install"
  | "update"
  | "uninstall"
  | "toggle"
  | "restart"
  | "addSource"
  | "removeSource"
  | "toggleSource"
  | "refresh";

const HEADLINE: Record<FailedAction, string> = {
  install: "failedInstall",
  update: "failedUpdate",
  uninstall: "failedUninstall",
  toggle: "failedToggle",
  restart: "failedRestart",
  addSource: "failedAddSource",
  removeSource: "failedRemoveSource",
  toggleSource: "failedToggleSource",
  refresh: "failedRefresh",
};

const REASON: Record<PluginErrorReason, string> = {
  network: "errorNetwork",
  restarting: "errorRestarting",
  busy: "errorBusy",
  alreadyInstalled: "errorAlreadyInstalled",
  versionGone: "errorVersionGone",
  sourceExists: "errorSourceExists",
  noChecksum: "errorNoChecksum",
  checksumMismatch: "errorChecksumMismatch",
  archiveRefused: "errorArchiveRefused",
  downloadFailed: "errorDownloadFailed",
  invalidRequest: "errorInvalidRequest",
  notFound: "errorNotFound",
  session: "errorSession",
  forbidden: "errorForbidden",
  generic: "errorGeneric",
};

/** La phrase complète d'un échec, dans la langue de l'administrateur. */
export function useErrorText() {
  const { t } = useTranslation("adminPlugins");
  return (action: FailedAction, error: PluginErrorDescription | undefined): string =>
    `${t(HEADLINE[action])} — ${t(REASON[error?.reason ?? "generic"])}`;
}

/**
 * Un échec sous le geste qui l'a produit : la phrase traduite, puis le détail
 * brut du serveur quand il en dit plus (« Download failed: HTTP 404 »).
 */
export function ActionError({ action, error, className = "" }: {
  action: FailedAction;
  error: PluginErrorDescription | undefined;
  className?: string;
}) {
  const text = useErrorText();
  return (
    <div role="alert" className={`text-xs leading-relaxed text-status-error-fg ${className}`}>
      <p>{text(action, error)}</p>
      {error?.detail && (
        <p className="mt-0.5 break-words font-mono text-[11px] text-content-tertiary">{error.detail}</p>
      )}
    </div>
  );
}
