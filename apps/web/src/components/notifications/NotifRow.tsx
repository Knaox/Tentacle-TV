import { memo, type KeyboardEvent } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { formatNotifTitle, notifBodyText } from "@tentacle-tv/api-client";
import type { AppNotification } from "@tentacle-tv/api-client";
import type { TFunction } from "i18next";
import { NotifStateBadge, TONE_STYLE, notifIcon } from "./notifVisuals";

interface NotifRowProps {
  notif: AppNotification;
  onOpen: (n: AppNotification) => void;
  onDelete: (id: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  isDeleting: boolean;
  hasRoute: boolean;
  t: TFunction;
}

/**
 * Une notification : son icône (l'état s'il y en a un), ce qu'elle dit, la
 * pastille d'état et l'heure ; non lue, un point de marque et un titre appuyé.
 * Toute la ligne ouvre la destination ; la croix (au survol ou au clavier)
 * la supprime.
 */
export const NotifRow = memo(function NotifRow({
  notif, onOpen, onDelete, selectionMode, isSelected, onToggleSelect, isDeleting, hasRoute, t,
}: NotifRowProps) {
  const body = notifBodyText(notif);
  const { Icon, tone } = notifIcon(notif);
  const toneStyle = tone ? TONE_STYLE[tone] : null;
  const activate = () => (selectionMode ? onToggleSelect(notif.id) : onOpen(notif));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    activate();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selectionMode ? isSelected : undefined}
      onClick={activate}
      onKeyDown={onKeyDown}
      className={`group relative flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.5)] ${
        !notif.read ? "bg-[rgba(var(--brand-rgb),0.06)]" : ""
      } ${isDeleting ? "pointer-events-none animate-fade-out" : ""}`}
    >
      {!notif.read && !selectionMode && (
        <span aria-hidden className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--brand)]" />
      )}
      {selectionMode ? (
        <span
          aria-hidden
          className={`mt-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
            isSelected ? "border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)] text-cta-brand-fg" : "border-line-strong"
          }`}
        >
          {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      ) : (
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={toneStyle ? { color: toneStyle.fg, background: toneStyle.bg } : { color: "var(--text-tertiary)", background: "var(--fill-soft)" }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 text-sm leading-5 ${!notif.read ? "font-semibold text-content-primary" : "text-content-secondary"}`}>
          {formatNotifTitle(notif, t)}
        </p>
        {body && <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-content-tertiary">{body}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <NotifStateBadge state={notif.state} label={(key) => t(key)} />
          <time dateTime={notif.createdAt} className="text-[11px] text-content-quaternary">{formatAgo(new Date(notif.createdAt), t)}</time>
        </div>
      </div>

      {!selectionMode && (
        <div className="flex flex-shrink-0 items-center self-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
            aria-label={t("notifications:delete")}
            title={t("notifications:delete")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-content-quaternary opacity-0 transition-opacity hover:bg-fill-soft hover:text-status-error-fg focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          {hasRoute && <ChevronRight aria-hidden className="h-4 w-4 text-content-disabled" />}
        </div>
      )}
    </div>
  );
});

// Le titre vient du formatage PARTAGÉ (api-client/utils/notificationText) :
// la même ligne s'affiche pareil ici, dans le miroir et dans la cloche mobile.

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
