import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useMarkRead,
} from "@tentacle/api-client";
import type { AppNotification } from "@tentacle/api-client";
import type { TFunction } from "i18next";

interface NotificationBellProps {
  /** Open dropdown to the right (for sidebar placement) */
  dropdownPosition?: "below" | "right";
}

export function NotificationBell({ dropdownPosition = "below" }: NotificationBellProps) {
  const { t } = useTranslation("notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: unread } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markAllMut = useMarkAllRead();
  const markOneMut = useMarkRead();

  const count = unread?.count ?? 0;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute z-50 rounded-xl border border-white/10 bg-tentacle-surface shadow-2xl ${
          dropdownPosition === "right"
            ? "bottom-0 left-full ml-2 w-80"
            : "right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-80"
        }`}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold text-white">{t("notifications:title")}</span>
            {count > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); markAllMut.mutate(); }}
                className="rounded-lg px-2 py-1 text-xs text-purple-400 hover:bg-white/10 hover:text-purple-300"
              >
                {t("notifications:markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">{t("notifications:noNotifications")}</p>
            ) : (
              notifications.map((n) => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={() => { if (!n.read) markOneMut.mutate(n.id); }}
                  t={t}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({ notif, onRead, t }: { notif: AppNotification; onRead: () => void; t: TFunction }) {
  const date = new Date(notif.createdAt);
  const ago = formatAgo(date, t);

  return (
    <div
      onClick={onRead}
      className={`cursor-pointer border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5 ${
        !notif.read ? "bg-purple-500/5" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {!notif.read && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${!notif.read ? "font-medium text-white" : "text-white/70"}`}>
            {notif.title}
          </p>
          {notif.body && (
            <p className="mt-0.5 text-xs text-white/40 line-clamp-2">{notif.body}</p>
          )}
          <p className="mt-1 text-[10px] text-white/30">{ago}</p>
        </div>
      </div>
    </div>
  );
}

function formatAgo(date: Date, t: TFunction): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("common:timeJustNow");
  if (mins < 60) return t("common:timeMinutesAgo", { mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("common:timeHoursAgo", { hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("common:timeDaysAgo", { days });
  return date.toLocaleDateString("fr-FR");
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
