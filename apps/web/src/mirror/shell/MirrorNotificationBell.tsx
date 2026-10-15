import { Fragment, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, BellOff } from "lucide-react";
import {
  groupNotificationsByDay,
  useDeleteAllNotifications,
  useDeleteNotification,
  useDeleteNotifications,
  useJellyfinClient,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useNotificationOpener,
  useNotificationsLive,
  useUnreadCount,
  type AppNotification,
} from "@tentacle-tv/api-client";
import { openFamilyNotification } from "../../family/familyPosterStore";
import { useNotificationPlugins } from "../../components/notifications/useNotificationPlugins";
import { BottomSheet } from "../ui/BottomSheet";
import { NotifSheetHeader } from "./NotifSheetHeader";
import { MirrorNotifRow } from "./MirrorNotifRow";

/**
 * La cloche de l'en-tête de l'app : une icône de 21 et sa pastille violette
 * (« 9+ » au-delà), qui ouvre la feuille des notifications (paliers 50 / 100 %).
 * Appui long sur une ligne : mode sélection, comme dans l'app.
 */
export function MirrorNotificationBell() {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: unread } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const deleteOne = useDeleteNotification();
  const deleteBatch = useDeleteNotifications();
  const deleteAll = useDeleteAllNotifications();
  const client = useJellyfinClient();
  useNotificationsLive({ token: client.getAccessToken() || localStorage.getItem("tentacle_token") });

  const plugins = useNotificationPlugins();

  const count = unread?.count ?? 0;

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    exitSelection();
  }, [exitSelection]);

  // La destination exacte (cible de l'émetteur, sinon la route du type) : la
  // même règle que la cloche du bureau et que le mobile.
  const openTarget = useNotificationOpener({ platform: "web", plugins, navigate, onLeave: close });
  const onPress = useCallback(
    (n: AppNotification) => {
      // « X vous invite… » : l'affiche de l'invitation, pas une page.
      if (openFamilyNotification(n)) {
        if (!n.read) markOne.mutate(n.id);
        return close();
      }
      openTarget(n);
    },
    [markOne, close, openTarget],
  );
  const groups = useMemo(() => groupNotificationsByDay(notifications ?? []), [notifications]);

  const onDeleteAll = useCallback(() => {
    if (window.confirm(t("confirmDeleteAll"))) deleteAll.mutate();
  }, [t, deleteAll]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `${t("title")}, ${count}` : t("title")}
        className="mirror-press relative -m-3 flex p-3 text-content-primary"
      >
        <Bell size={21} strokeWidth={2} aria-hidden />
        {count > 0 && (
          <span className="absolute right-[6px] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-cta-brand-fg">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      <BottomSheet open={open} onClose={close} label={t("title")}>
        <NotifSheetHeader
          selectionMode={selectionMode}
          selectedCount={selected.size}
          unread={count}
          total={notifications?.length ?? 0}
          onMarkAll={() => markAll.mutate()}
          onSelect={() => setSelectionMode(true)}
          onDeleteAll={onDeleteAll}
          onDeleteSelected={() => deleteBatch.mutate([...selected], { onSettled: exitSelection })}
          onCancel={exitSelection}
        />
        <div className="px-4 pt-3">
          {groups.length === 0 ? (
            <div className="mt-12 flex flex-col items-center gap-2 px-6 text-center">
              <BellOff size={40} className="mb-2 text-content-quaternary" aria-hidden />
              <p className="text-[15px] font-semibold text-content-primary">{t("emptyTitle")}</p>
              <p className="text-[13px] leading-[18px] text-content-tertiary">{t("emptyHint")}</p>
            </div>
          ) : (
            groups.map(({ group, items }) => (
              <Fragment key={group}>
                <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wider text-content-quaternary">
                  {t(group === "today" ? "groupToday" : "groupEarlier")}
                </p>
                {items.map((n) => (
                  <MirrorNotifRow
                    key={n.id}
                    notif={n}
                    selectionMode={selectionMode}
                    isSelected={selected.has(n.id)}
                    onPress={() => (selectionMode ? toggle(n.id) : onPress(n))}
                    onLongPress={() => {
                      setSelectionMode(true);
                      toggle(n.id);
                    }}
                    onDelete={() => deleteOne.mutate(n.id)}
                  />
                ))}
              </Fragment>
            ))
          )}
        </div>
      </BottomSheet>
    </>
  );
}
