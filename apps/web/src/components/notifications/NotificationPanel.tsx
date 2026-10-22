import { useMemo } from "react";
import { BellRing, CheckCheck, ListChecks, Trash2 } from "lucide-react";
import type { TFunction } from "i18next";
import { groupNotificationsByDay, type AppNotification } from "@tentacle-tv/api-client";
import { NotifRow } from "./NotifRow";

interface SelectionApi {
  isSelecting: boolean;
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
}

interface NotificationPanelProps {
  notifications: AppNotification[] | undefined;
  unread: number;
  sel: SelectionApi;
  deletingIds: ReadonlySet<string>;
  hasRoute: (n: AppNotification) => boolean;
  onOpen: (n: AppNotification) => void;
  onDelete: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteSelected: () => void;
  onAskDeleteAll: () => void;
  t: TFunction;
}

const ICON_BUTTON = "flex h-8 w-8 items-center justify-center rounded-lg transition-colors";

/**
 * Le contenu du panneau des notifications : un en-tête (titre, non lues,
 * « Tout marquer comme lu », sélection, tout supprimer), puis les
 * notifications par jour — Aujourd'hui, Plus tôt —, ou un état vide. Seule la
 * liste défile : l'en-tête reste en place, quelle que soit la hauteur de la
 * fenêtre (le calque borne le panneau, `FloatingLayer`).
 */
export function NotificationPanel({
  notifications, unread, sel, deletingIds, hasRoute, onOpen, onDelete, onMarkAllRead, onDeleteSelected, onAskDeleteAll, t,
}: NotificationPanelProps) {
  const groups = useMemo(() => groupNotificationsByDay(notifications ?? []), [notifications]);
  const empty = !notifications || notifications.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="lg-sep flex flex-shrink-0 items-center gap-2 border-b border-line-subtle px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-content-primary">
            {sel.isSelecting ? t("notifications:selected", { count: sel.count }) : t("notifications:title")}
          </h2>
          {!sel.isSelecting && unread > 0 && (
            <p className="text-xs text-content-tertiary">{t("notifications:unreadCount", { count: unread })}</p>
          )}
        </div>
        {sel.isSelecting ? (
          <>
            <button type="button" onClick={() => sel.selectAll((notifications ?? []).map((n) => n.id))} title={t("notifications:select")} aria-label={t("notifications:select")} className={`${ICON_BUTTON} text-content-tertiary hover:bg-fill-soft hover:text-content-primary`}>
              <ListChecks className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDeleteSelected} disabled={sel.count === 0} title={t("notifications:deleteSelected")} aria-label={t("notifications:deleteSelected")} className={`${ICON_BUTTON} text-status-error-fg hover:bg-danger-surface disabled:opacity-40`}>
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={sel.exitSelectionMode} className="h-8 rounded-lg px-2.5 text-xs font-medium text-content-secondary hover:bg-fill-soft">
              {t("notifications:cancel")}
            </button>
          </>
        ) : (
          <>
            {unread > 0 && (
              <button type="button" onClick={onMarkAllRead} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--brand-light)] hover:bg-[var(--brand-soft)]">
                <CheckCheck className="h-4 w-4" />
                {t("notifications:markAllRead")}
              </button>
            )}
            {!empty && (
              <>
                <button type="button" onClick={sel.enterSelectionMode} title={t("notifications:select")} aria-label={t("notifications:select")} className={`${ICON_BUTTON} text-content-tertiary hover:bg-fill-soft hover:text-content-primary`}>
                  <ListChecks className="h-4 w-4" />
                </button>
                <button type="button" onClick={onAskDeleteAll} title={t("notifications:deleteAll")} aria-label={t("notifications:deleteAll")} className={`${ICON_BUTTON} text-content-tertiary hover:bg-danger-surface hover:text-status-error-fg`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </>
        )}
      </header>

      {empty ? (
        <EmptyNotifications t={t} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {groups.map(({ group, items }) => (
            <section key={group} aria-label={t(group === "today" ? "notifications:groupToday" : "notifications:groupEarlier")}>
              <h3 className="lg-menu-sticky lg-menu-label sticky top-0 z-[1] bg-[var(--surface-dropdown)] px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-content-quaternary">
                {t(group === "today" ? "notifications:groupToday" : "notifications:groupEarlier")}
              </h3>
              <div className="space-y-0.5">
                {items.map((n) => (
                  <NotifRow
                    key={n.id}
                    notif={n}
                    onOpen={onOpen}
                    onDelete={onDelete}
                    selectionMode={sel.isSelecting}
                    isSelected={sel.isSelected(n.id)}
                    onToggleSelect={sel.toggle}
                    isDeleting={deletingIds.has(n.id)}
                    hasRoute={hasRoute(n)}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyNotifications({ t }: { t: TFunction }) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <span
        aria-hidden
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--brand-light)]"
        style={{ background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.18), rgba(var(--brand-accent-rgb),0.14))" }}
      >
        <BellRing className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-content-primary">{t("notifications:emptyTitle")}</p>
      <p className="mt-1 max-w-[16rem] text-xs leading-5 text-content-tertiary">{t("notifications:emptyHint")}</p>
    </div>
  );
}
