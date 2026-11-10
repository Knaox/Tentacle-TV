import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BellIcon as Bell } from "@phosphor-icons/react/dist/csr/Bell";
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
        // Un rond du groupe « actions » de la barre : sans fond au repos, le verre du groupe
        // est sa surface. Ouvert, il garde son voile (jeton du verre natif, sinon l'encre).
        data-on={count > 0 || undefined}
        className="icon-btn relative"
        style={open ? { background: "var(--lg-chrome-button-open, var(--fill-soft))" } : undefined}
      >
        <Bell size={20} weight={count > 0 ? "fill" : "regular"} aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className="num absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill px-1 text-[10px] font-bold leading-none"
            style={{
              // Un état actif : la teinte franche, unie (plus de dégradé de marque ni de halo).
              // `--lg-chrome-badge-bg` : le jeton du verre natif, posé là seulement.
              background: "var(--lg-chrome-badge-bg, var(--accent))",
              color: "var(--on-accent)",
            }}
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
        // Un menu de la couche de verre : OPAQUE hors verre natif, donc sans flou (carnet, § 4).
        className="lg-menu lg-menu-wide flex w-[24rem] flex-col overflow-hidden rounded-tile bg-surface-dropdown shadow-menu"
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
