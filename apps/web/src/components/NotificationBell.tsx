import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useMarkRead,
  useDeleteNotification,
  useDeleteNotifications,
  useDeleteAllNotifications,
  resolveNotificationRoute,
} from "@tentacle-tv/api-client";
import type { AppNotification } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { NotifRow } from "./notifications/NotifRow";
import { ConfirmDeleteModal } from "./notifications/ConfirmDeleteModal";

interface NotificationBellProps {
  dropdownPosition?: "below" | "right";
}

export function NotificationBell({ dropdownPosition = "below" }: NotificationBellProps) {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const { data: unread } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markAllMut = useMarkAllRead();
  const markOneMut = useMarkRead();
  const deleteOneMut = useDeleteNotification();
  const deleteBatchMut = useDeleteNotifications();
  const deleteAllMut = useDeleteAllNotifications();
  const sel = useMultiSelect();

  const activePluginsMeta = useActivePluginsMeta();
  const pluginNavMeta = useMemo(
    () =>
      activePluginsMeta
        .filter((p) => p.configEnabled)
        .map((p) => ({
          pluginId: p.pluginId,
          navItems: (p.navItems || []).filter((n: Record<string, unknown>) => !n.admin) as Array<{ path: string; platforms: string[] }>,
        })),
    [activePluginsMeta],
  );

  const count = unread?.count ?? 0;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        sel.exitSelectionMode();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, sel]);

  const handleNotifClick = useCallback(
    (n: AppNotification) => {
      if (!n.read) markOneMut.mutate(n.id);
      const route = resolveNotificationRoute(n, "web", pluginNavMeta);
      if (route) {
        setOpen(false);
        sel.exitSelectionMode();
        navigate(route);
      }
    },
    [markOneMut, navigate, pluginNavMeta, sel],
  );

  const handleDeleteOne = useCallback(
    (id: string) => {
      setDeletingIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        deleteOneMut.mutate(id);
        setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }, 300);
    },
    [deleteOneMut],
  );

  const handleDeleteSelected = useCallback(() => {
    const ids = [...sel.selected];
    deleteBatchMut.mutate(ids, { onSettled: () => sel.exitSelectionMode() });
  }, [sel, deleteBatchMut]);

  const handleDeleteAll = useCallback(() => {
    deleteAllMut.mutate(undefined, { onSuccess: () => setConfirmDeleteAll(false) });
  }, [deleteAllMut]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all duration-200 hover:bg-white/10 hover:text-white/80"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <BellIcon />
        {count > 0 && (
          <div
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full animate-pulse-glow"
            style={{ background: "#8B5CF6", boxShadow: "0 0 6px rgba(139,92,246,0.6)" }}
          />
        )}
      </button>

      {open && (
        <div
          className={`absolute z-50 animate-scale-in overflow-hidden rounded-xl ${
            dropdownPosition === "right"
              ? "bottom-0 left-full ml-2 w-96 origin-bottom-left"
              : "right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-96 origin-top-right"
          }`}
          style={{
            background: "rgba(15,15,25,0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold text-white">
              {sel.isSelecting ? t("notifications:selected", { count: sel.count }) : t("notifications:title")}
            </span>
            <div className="flex items-center gap-1">
              {sel.isSelecting ? (
                <>
                  <button onClick={() => sel.selectAll((notifications ?? []).map((n) => n.id))} title={t("notifications:select")} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70">
                    <SelectAllIcon />
                  </button>
                  <button onClick={handleDeleteSelected} disabled={sel.count === 0} title={t("notifications:deleteSelected")} className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-30">
                    <TrashIcon />
                  </button>
                  <button onClick={() => sel.exitSelectionMode()} className="rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10">
                    {t("notifications:cancel")}
                  </button>
                </>
              ) : (
                <>
                  {count > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAllMut.mutate(); }}
                      className="rounded-lg px-2 py-1 text-xs text-purple-400 hover:bg-white/10 hover:text-purple-300"
                    >
                      {t("notifications:markAllRead")}
                    </button>
                  )}
                  {notifications && notifications.length > 0 && (
                    <>
                      <button onClick={() => sel.enterSelectionMode()} title={t("notifications:select")} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-white/10 hover:text-white/60">
                        <SelectIcon />
                      </button>
                      <button onClick={() => setConfirmDeleteAll(true)} title={t("notifications:deleteAll")} className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400/60 hover:bg-red-500/10 hover:text-red-400">
                        <TrashIcon />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">{t("notifications:noNotifications")}</p>
            ) : (
              notifications.map((n) => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onClick={() => handleNotifClick(n)}
                  onDelete={() => handleDeleteOne(n.id)}
                  selectionMode={sel.isSelecting}
                  isSelected={sel.isSelected(n.id)}
                  onToggleSelect={() => sel.toggle(n.id)}
                  isDeleting={deletingIds.has(n.id)}
                  hasRoute={resolveNotificationRoute(n, "web", pluginNavMeta) !== null}
                  t={t}
                />
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={confirmDeleteAll}
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDeleteAll(false)}
        title={t("notifications:deleteAll")}
        message={t("notifications:confirmDeleteAll")}
        confirmLabel={t("notifications:confirm")}
        cancelLabel={t("notifications:cancel")}
        isPending={deleteAllMut.isPending}
      />
    </div>
  );
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function SelectAllIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
