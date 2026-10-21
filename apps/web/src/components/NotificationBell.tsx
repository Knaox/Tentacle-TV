import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useMarkRead,
  useDeleteNotification,
  useDeleteNotifications,
  useDeleteAllNotifications,
  useNotificationsLive,
  useNotificationOpener,
  useJellyfinClient,
  notificationHasDestination,
} from "@tentacle-tv/api-client";
import type { AppNotification } from "@tentacle-tv/api-client";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { openFamilyNotification } from "../family/familyPosterStore";
import { ConfirmDeleteModal } from "./notifications/ConfirmDeleteModal";
import { NotificationPanel } from "./notifications/NotificationPanel";
import { useNotificationPlugins } from "./notifications/useNotificationPlugins";
import { FloatingLayer } from "./floating/FloatingLayer";

/** Au-delà, la pastille dit « 9+ » : un nombre précis n'apprend plus rien. */
const BADGE_MAX = 9;

/**
 * La cloche de la barre (web, bureau). Le panneau est posé par le calque
 * commun : jamais coupé par le bord de la fenêtre, il défile dedans quand
 * elle est basse. Un clic sur une notification mène à sa destination EXACTE
 * (la cible posée par l'émetteur, sinon la route de son type) et la marque lue.
 */
export function NotificationBell() {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data: unread } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markAllMut = useMarkAllRead();
  const markOneMut = useMarkRead();
  const deleteOneMut = useDeleteNotification();
  const deleteBatchMut = useDeleteNotifications();
  const deleteAllMut = useDeleteAllNotifications();
  const sel = useMultiSelect();
  const plugins = useNotificationPlugins();

  // La cloche vit sur toutes les pages : elle s'abonne elle-même au socket
  // (même jeton que l'accueil ; null = cookie sur le web) pour se rafraîchir
  // à l'instant où une notification est écrite, sans attendre le polling.
  const client = useJellyfinClient();
  useNotificationsLive({ token: client.getAccessToken() || localStorage.getItem("tentacle_token") });

  const count = unread?.count ?? 0;

  const close = useCallback(() => {
    setOpen(false);
    sel.exitSelectionMode();
  }, [sel]);

  const openTarget = useNotificationOpener({ platform: "web", plugins, navigate, onLeave: close });

  const handleOpen = useCallback(
    (n: AppNotification) => {
      // « X vous invite… » : l'affiche de l'invitation, pas une page.
      if (openFamilyNotification(n)) {
        if (!n.read) markOneMut.mutate(n.id);
        close();
        return;
      }
      openTarget(n);
    },
    [close, markOneMut, openTarget],
  );

  const hasRoute = useCallback((n: AppNotification) => notificationHasDestination(n, "web", plugins), [plugins]);

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

  const badge = count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={count > 0 ? `${t("notifications:title")} — ${t("notifications:unreadCount", { count })}` : t("notifications:title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-content-quaternary transition-colors duration-200 hover:bg-fill-soft hover:text-content-secondary"
        style={{ background: open ? "var(--fill-soft)" : "var(--fill-subtle)" }}
      >
        <Bell className="h-5 w-5" strokeWidth={2} />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-cta-brand-fg"
            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))", boxShadow: "0 2px 6px rgba(var(--brand-rgb), 0.45)" }}
          >
            {badge}
          </span>
        )}
      </button>

      <FloatingLayer
        open={open}
        anchor={buttonRef}
        onDismiss={close}
        side="bottom"
        align="end"
        role="dialog"
        ariaLabel={t("notifications:title")}
        className="lg-menu flex w-[24rem] flex-col overflow-hidden rounded-2xl"
        style={{
          background: "var(--surface-dropdown)",
          backdropFilter: "blur(var(--blur-dropdown))",
          WebkitBackdropFilter: "blur(var(--blur-dropdown))",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-dropdown)",
        }}
      >
        <NotificationPanel
          notifications={notifications}
          unread={count}
          sel={sel}
          deletingIds={deletingIds}
          hasRoute={hasRoute}
          onOpen={handleOpen}
          onDelete={handleDeleteOne}
          onMarkAllRead={() => markAllMut.mutate()}
          onDeleteSelected={handleDeleteSelected}
          onAskDeleteAll={() => setConfirmDeleteAll(true)}
          t={t}
        />
      </FloatingLayer>

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
