import { useTranslation } from "react-i18next";
import { CheckCircle, CheckSquare, Trash2, type LucideIcon } from "lucide-react";
import type { NotificationFilter } from "@tentacle-tv/api-client";

/** Un bouton texte du système de boutons sobres (`PlainButton`) : accent, neutre ou rouge, jamais un pavé. */
function Plain({ Icon, label, tone = "neutral", disabled, onPress }: {
  Icon?: LucideIcon;
  label: string;
  tone?: "accent" | "neutral" | "destructive";
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = disabled
    ? "text-content-quaternary"
    : tone === "accent" ? "text-[var(--brand-light)]" : tone === "destructive" ? "text-[var(--status-error)]" : "text-content-secondary";
  return (
    <button type="button" onClick={onPress} disabled={disabled} className={`flex min-h-9 items-center gap-1.5 px-1 text-[14px] font-semibold active:opacity-70 ${color}`}>
      {Icon && <Icon size={15} aria-hidden />}
      {label}
    </button>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onPress}
      className={`flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
        active ? "bg-[color:var(--surface-3)] text-content-primary shadow-sm" : "text-content-secondary"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * L'en-tête du centre de notifications — `NotifCenterHeader` du mobile
 * refait par notifs : le titre et le nombre de non lues, « Sélectionner » et
 * « Tout supprimer » ; dessous, les filtres « Tout » / « Non lues » et « Tout
 * marquer comme lu ». En sélection : le compte, tout (dé)sélectionner,
 * supprimer, annuler. Boutons sobres : du texte, le danger en rouge.
 */
export function NotifSheetHeader(p: {
  filter: NotificationFilter;
  onFilter: (filter: NotificationFilter) => void;
  unread: number;
  total: number;
  shown: number;
  selectionMode: boolean;
  selectedCount: number;
  onMarkAll: () => void;
  onSelect: () => void;
  onSelectAll: () => void;
  onDeleteAll: () => void;
  onDeleteSelected: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("notifications");

  if (p.selectionMode) {
    return (
      <div className="flex flex-col gap-1 border-b border-line-subtle px-4 pb-2 pt-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="truncate text-lg font-bold text-content-primary">{t("selected", { count: p.selectedCount })}</h2>
          <Plain label={t("cancel")} onPress={p.onCancel} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Plain Icon={CheckSquare} label={p.selectedCount === p.shown ? t("deselectAll") : t("selectAll")} onPress={p.onSelectAll} />
          <Plain
            Icon={Trash2}
            tone="destructive"
            label={p.selectedCount > 0 ? `${t("delete")} (${p.selectedCount})` : t("delete")}
            disabled={p.selectedCount === 0}
            onPress={p.onDeleteSelected}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-line-subtle px-4 pb-2.5 pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-content-primary">{t("title")}</h2>
          <p className="truncate text-[13px] text-content-tertiary">{p.unread > 0 ? t("unreadCount", { count: p.unread }) : t("emptyUnreadTitle")}</p>
        </div>
        {p.total > 0 && (
          <div className="flex shrink-0 gap-2">
            <Plain label={t("select")} onPress={p.onSelect} />
            <Plain label={t("deleteAll")} tone="destructive" onPress={p.onDeleteAll} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t("filtersA11y")} className="flex gap-0.5 rounded-full border border-line-subtle bg-fill-subtle p-0.5">
          <Segment label={t("filterAll")} active={p.filter === "all"} onPress={() => p.onFilter("all")} />
          <Segment label={p.unread > 0 ? `${t("filterUnread")} · ${p.unread}` : t("filterUnread")} active={p.filter === "unread"} onPress={() => p.onFilter("unread")} />
        </div>
        {p.unread > 0 && <Plain Icon={CheckCircle} tone="accent" label={t("markAllReadFull")} onPress={p.onMarkAll} />}
      </div>
    </div>
  );
}
