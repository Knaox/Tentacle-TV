import type { AppNotification } from "@tentacle-tv/api-client";
import type { TFunction } from "i18next";

interface NotifRowProps {
  notif: AppNotification;
  onClick: () => void;
  onDelete: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  isDeleting: boolean;
  hasRoute: boolean;
  t: TFunction;
}

export function NotifRow({
  notif, onClick, onDelete, selectionMode, isSelected, onToggleSelect, isDeleting, hasRoute, t,
}: NotifRowProps) {
  const date = new Date(notif.createdAt);
  const ago = formatAgo(date, t);

  return (
    <div
      onClick={selectionMode ? onToggleSelect : onClick}
      className={`group cursor-pointer border-b border-white/5 px-4 py-3 transition-all duration-300 hover:bg-white/5 ${
        !notif.read ? "bg-purple-500/5" : ""
      } ${isDeleting ? "animate-fade-out pointer-events-none" : ""}`}
    >
      <div className="flex items-start gap-2">
        {selectionMode ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className={`mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
              isSelected
                ? "border-purple-500 bg-purple-500"
                : "border-white/30 bg-transparent hover:border-white/50"
            }`}
          >
            {isSelected && <CheckIcon />}
          </button>
        ) : (
          !notif.read && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${!notif.read ? "font-medium text-white" : "text-white/70"}`}>
            {formatNotifTitle(notif, t)}
          </p>
          {notif.body && notif.type !== "ticket_status" && (
            <p className="mt-0.5 text-xs text-white/40 line-clamp-2">{notif.body}</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] text-white/30">{ago}</span>
            {hasRoute && !selectionMode && <ChevronIcon />}
          </div>
        </div>
        {!selectionMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
          >
            <XIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──

const STATUS_TKEYS: Record<string, string> = {
  open: "tickets:statusOpen",
  in_progress: "tickets:statusInProgress",
  resolved: "tickets:statusResolved",
  closed: "tickets:statusClosed",
};

const FR_STATUS_TO_KEY: Record<string, string> = {
  "Ouvert": "open", "En cours": "in_progress", "Résolu": "resolved", "Fermé": "closed",
};

export function formatNotifTitle(n: AppNotification, t: TFunction): string {
  if (n.type === "ticket_reply") {
    const legacy = n.title.match(/^Réponse sur\s+"(.+)"$/);
    const subject = legacy ? legacy[1] : n.title;
    return t("notifications:ticketReplyTitle", { subject });
  }
  if (n.type === "ticket_status") {
    const isNew = n.body && STATUS_TKEYS[n.body];
    if (isNew) {
      return t("notifications:ticketStatusTitle", { subject: n.title, status: t(STATUS_TKEYS[n.body!]) });
    }
    const legacy = n.title.match(/^Ticket\s+"(.+?)"\s+—\s+(.+)$/);
    if (legacy) {
      const statusKey = FR_STATUS_TO_KEY[legacy[2]];
      if (statusKey) {
        return t("notifications:ticketStatusTitle", { subject: legacy[1], status: t(STATUS_TKEYS[statusKey]) });
      }
    }
  }
  return n.title;
}

export function formatAgo(date: Date, t: TFunction): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("common:timeJustNow");
  if (mins < 60) return t("common:timeMinutesAgo", { mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("common:timeHoursAgo", { hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("common:timeDaysAgo", { days });
  return date.toLocaleDateString();
}

// ── Icons ──

function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-3 w-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-white/40 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
