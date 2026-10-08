import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ChevronDown, ChevronRight, CircleArrowUp, Database, DatabaseZap, Eye, EyeOff, Globe, HardDriveDownload, KeyRound, LockOpen,
  OctagonAlert, Puzzle, ServerOff, SkipForward, SlidersHorizontal, Sparkles, Unplug, Zap, type LucideIcon,
} from "lucide-react";
import { useHintSupported, useSetHintDismissed } from "@tentacle-tv/api-client";
import type { DismissibleHint } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { ENTRY_ACTION, detailsKind, entryKeys, type EntryAction, type EntryId } from "./attentionCopy";
import { EntryDetails } from "./EntryDetails";
import type { AttentionContext } from "./useAdminAttention";

/**
 * Une entrée de la vue d'ensemble : un titre court, UNE phrase qui dit ce que
 * ça change, UNE action, le détail replié. Une recommandation se masque
 * (préférence du COMPTE, `/api/preferences/hints`) ; masquée, elle se montre
 * en retrait sous « N masquées », avec « Rétablir » pour seul geste.
 */

const ICON: Record<EntryId, LucideIcon> = {
  jellyfinNotConfigured: Unplug,
  jellyfinUnreachable: ServerOff,
  jellyfinKeyRejected: KeyRound,
  databaseDown: Database,
  jellyfinIncompatible: OctagonAlert,
  serverUpdateRequired: CircleArrowUp,
  extensionsRefused: Puzzle,
  databaseSourceChanged: DatabaseZap,
  databaseNeverMigrated: DatabaseZap,
  publicUrl: Globe,
  tmdbKey: Sparkles,
  jellyfin: SlidersHorizontal,
  segmentPlugins: SkipForward,
  directPlay: Zap,
  removeMariadb: HardDriveDownload,
};

const TILE = {
  blocking: "bg-status-error-bg text-status-error-fg",
  recommendation: "bg-[var(--brand-soft)] text-[var(--brand-light)]",
  hidden: "bg-fill-soft text-content-tertiary",
};

const PILL =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:rgba(var(--brand-rgb),0.4)] bg-[rgba(var(--brand-rgb),0.16)] px-3.5 text-[13px] font-medium text-content-primary transition hover:bg-[rgba(var(--brand-rgb),0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";
const QUIET =
  "inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-content-secondary transition hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface Props {
  id: EntryId;
  variant: string | null;
  items: readonly string[];
  family: "blocking" | "recommendation";
  /** Le rappel qui masque une recommandation. */
  hint?: DismissibleHint;
  /** Masquée par le compte : en retrait, « Rétablir » pour seul geste. */
  hidden?: boolean;
  context: AttentionContext;
}

export const AttentionEntry = memo(function AttentionEntry({ id, variant, items, family, hint, hidden = false, context }: Props) {
  const { t } = useTranslation("adminOverview");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const action = ENTRY_ACTION[id];
  const values = {
    count: items.length,
    version: context.jellyfinVersion ?? "?",
    required: context.serverRequired ?? "?",
    current: context.serverCurrent ?? "?",
    url: context.jellyfinUrl ?? "?",
    names: items.join(", "),
  };
  const title = t(entryKeys(id, variant, "title"), values);
  const Icon = id === "publicUrl" && variant === "not-https" ? LockOpen : ICON[id];
  const foldable = action.kind !== "toggle" && detailsKind(id) !== "none";

  return (
    <li className="relative flex gap-3 px-5 py-4">
      <span aria-hidden="true" className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${TILE[hidden ? "hidden" : family]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        {/* « Masquer » posé dans le coin : la phrase garde le même rythme qu'une entrée à régler. */}
        <h3 className={`pt-1.5 text-sm font-semibold ${hint ? "pr-28" : ""} ${hidden ? "text-content-secondary" : "text-content-primary"}`}>{title}</h3>
        {hint ? <DismissButton hint={hint} hidden={hidden} title={title} /> : null}
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-content-tertiary">{t(entryKeys(id, variant, "body"), values)}</p>
        {hidden ? null : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ActionButton action={action} open={open} panelId={panelId} onToggle={() => setOpen((value) => !value)} />
              {foldable ? (
                <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)} className={QUIET}>
                  {t("details")}
                  <ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </button>
              ) : null}
            </div>
            {open ? (
              <div id={panelId} className="mt-3">
                <EntryDetails id={id} variant={variant} items={items} context={context} values={values} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
});

function ActionButton({ action, open, panelId, onToggle }: { action: EntryAction; open: boolean; panelId: string; onToggle: () => void }) {
  const { t } = useTranslation("adminOverview");
  if (action.kind === "link") {
    return (
      <Link to={action.to} className={PILL}>
        {t(action.label)}
        <ChevronRight size={14} aria-hidden="true" className="text-[var(--brand-light)]" />
      </Link>
    );
  }
  if (action.kind === "anchor") {
    return (
      <button type="button" onClick={() => revealCard(action.target)} className={PILL}>
        {t(action.label)}
        <ChevronDown size={14} aria-hidden="true" className="text-[var(--brand-light)]" />
      </button>
    );
  }
  return (
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className={PILL}>
      {open ? t(action.hideLabel) : t(action.label)}
      <ChevronDown size={14} aria-hidden="true" className={`text-[var(--brand-light)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

/** Une carte de la même page : on y va, et le focus la suit (lecteurs d'écran, clavier). */
function revealCard(target: string) {
  const card = document.getElementById(target);
  if (!card) return;
  const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  card.setAttribute("tabindex", "-1");
  card.focus({ preventScroll: true });
}

function DismissButton({ hint, hidden, title }: { hint: DismissibleHint; hidden: boolean; title: string }) {
  const { t } = useTranslation("adminOverview");
  const { show } = useToast();
  const setDismissed = useSetHintDismissed();
  // Un rappel que le serveur ne sait pas retenir (liste `known`) : pas de geste voué au refus.
  const supported = useHintSupported(hint);
  if (supported === false) return null;
  const label = hidden ? t("restoreLabel", { title }) : t("dismissLabel", { title });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={setDismissed.isPending}
      onClick={() => setDismissed.mutate({ hint, dismissed: !hidden }, { onError: () => show("error", t("saveError")) })}
      className={`${QUIET} absolute right-3 top-3 text-xs disabled:opacity-50`}
    >
      {hidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
      {hidden ? t("restore") : t("dismiss")}
    </button>
  );
}
