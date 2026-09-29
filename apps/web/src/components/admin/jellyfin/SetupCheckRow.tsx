import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, CircleHelp, CircleMinus, ExternalLink, RotateCw, Sparkles, type LucideIcon } from "lucide-react";
import type { SetupActionId, SetupCheck, SetupState } from "@tentacle-tv/shared";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { ActionPill } from "../sessions/ActionPill";
import { StatusPill, type StatusTone } from "../kit";
import { SetupCheckDetails } from "./SetupCheckDetails";
import { CONFIRMED_ACTIONS, LEVEL_LABEL, STATE_LABEL, splitLibraries, stateTone, type LanguageChoice } from "./setupPresentation";

/**
 * Un réglage recommandé : pourquoi il compte, où en est le serveur, et le
 * moyen d'y remédier — le geste en un clic quand il existe (confirmé s'il est
 * lourd : installer, lancer une génération), sinon la page du tableau de bord
 * de Jellyfin, qui devient alors l'action principale de la ligne.
 */

const ICON: Record<SetupState, LucideIcon> = {
  done: CircleCheck,
  todo: CircleAlert,
  "pending-restart": RotateCw,
  "not-needed": CircleMinus,
  unknown: CircleHelp,
};

const ICON_TONE: Record<StatusTone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
  info: "bg-status-info-bg text-status-info-fg",
  neutral: "bg-fill-soft text-content-tertiary",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-light)]",
};

/** Les gestes qui RÈGLENT quelque chose ; les autres (générer, relancer) prolongent un réglage fait. */
const FIXES: ReadonlySet<SetupActionId> = new Set([
  "enableTrickplay", "enableRealtimeMonitor", "setMetadataLanguage", "installChapterSegments", "refreshMissingMetadata",
]);

interface Props {
  check: SetupCheck;
  dashboardUrl: string | null;
  jellyfinVersion: string | null;
  language: LanguageChoice;
  /** Le geste en vol dans toute la liste — un seul à la fois, comme le serveur. */
  running: SetupActionId | null;
  failed: SetupActionId | null;
  onApply: (action: SetupActionId) => void;
}

export function SetupCheckRow({ check, dashboardUrl, jellyfinVersion, language, running, failed, onApply }: Props) {
  const { t } = useTranslation(["adminJellyfin", "common"]);
  const [confirming, setConfirming] = useState(false);
  const tone = stateTone(check);
  const Icon = ICON[check.state];
  const action = check.action;
  const confirm = action ? CONFIRMED_ACTIONS[action] : undefined;
  const fixable = action !== null && FIXES.has(action);
  const dashboardHref = dashboardUrl ? `${dashboardUrl}${check.dashboardPath}` : null;
  // Rien en un clic et quelque chose à faire : le tableau de bord EST le geste.
  const dashboardIsMain = !fixable && (check.state === "todo" || check.state === "unknown");

  const label = (() => {
    switch (action) {
      case "enableTrickplay":
      case "enableRealtimeMonitor":
        return t("enableOnLibraries", { count: splitLibraries(check).off.length });
      case "setMetadataLanguage":
        return t("languageApply", { language: language.label });
      case "installChapterSegments":
        return t("installOfficial", { name: "Chapter Segments Provider" });
      case "generateTrickplay":
        return t("generateNow");
      case "scanMediaSegments":
        return t("rescanSegments");
      case "refreshMissingMetadata":
        return t("refreshMetadata");
      default:
        return "";
    }
  })();
  const status = action && running === action ? "busy" : action && failed === action ? "error" : "idle";

  return (
    <li className="flex gap-3 px-5 py-4">
      <span aria-hidden="true" className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold text-content-primary">{t(`check_${check.id}`)}</h3>
          <StatusPill tone={tone} size="sm">{t(STATE_LABEL[check.state])}</StatusPill>
          <span className="text-[11px] font-medium uppercase tracking-wider text-content-quaternary">{t(LEVEL_LABEL[check.level])}</span>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-content-tertiary">{t(`why_${check.id}`)}</p>
        <div className="mt-1.5 space-y-1">
          <SetupCheckDetails check={check} jellyfinVersion={jellyfinVersion} />
        </div>
        {(action || dashboardHref) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {action && (
              <ActionPill
                size="sm"
                tone={fixable ? "brand" : "neutral"}
                icon={fixable ? Sparkles : RotateCw}
                label={label}
                status={status}
                disabled={running !== null && running !== action}
                onClick={() => (confirm ? setConfirming(true) : onApply(action))}
              />
            )}
            {dashboardHref && (
              <a
                href={dashboardHref}
                target="_blank"
                rel="noreferrer"
                className={
                  dashboardIsMain
                    ? "inline-flex h-9 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-soft px-3.5 text-[13px] font-medium text-content-primary transition hover:border-line-strong hover:bg-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                    : "inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-medium text-content-secondary underline-offset-4 transition hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                }
              >
                {t("openInJellyfin")}
                <ExternalLink size={dashboardIsMain ? 14 : 12} aria-hidden="true" />
                <span className="sr-only"> {t("opensNewTab")}</span>
              </a>
            )}
          </div>
        )}
      </div>
      {confirm && action && (
        <ConfirmDialog
          open={confirming}
          title={t(confirm.title, { name: "Chapter Segments Provider" })}
          message={t(confirm.body)}
          confirmLabel={t(confirm.confirm)}
          cancelLabel={t("common:cancel")}
          onConfirm={() => {
            setConfirming(false);
            onApply(action);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
