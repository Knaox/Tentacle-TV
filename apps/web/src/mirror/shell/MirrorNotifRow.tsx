import { memo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle, Trash2 } from "lucide-react";
import { formatNotifTitle, notifBodyText, notificationAgo, type AppNotification } from "@tentacle-tv/api-client";
import { ROW_SWIPE_SLOP, decideRowSwipe } from "@tentacle-tv/shared";
import { useLongPress } from "../ui/useLongPress";
import { NotifStateBadge } from "../../components/notifications/notifVisuals";

/** La date relative du mobile (règle partagée `notificationAgo`) : « il y a 5 min », … puis la date. */
function agoLabel(dateStr: string, t: (k: string, o?: Record<string, unknown>) => string, locale: string): string {
  const ago = notificationAgo(dateStr, Date.now());
  switch (ago.unit) {
    case "now": return t("justNow");
    case "minutes": return t("minutesAgo", { count: ago.count });
    case "hours": return t("hoursAgo", { count: ago.count });
    case "days": return t("daysAgo", { count: ago.count });
    case "date": return ago.date.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }
}

interface Props {
  notif: AppNotification;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}

/**
 * Une notification — `SwipeableNotifRow` du mobile refait par notifs : carte
 * `surface.s2` de rayon 12, point violet des non lues, titre 14, corps 13 sur
 * deux lignes, état et date. Au doigt, glisser vers la DROITE la marque lue,
 * vers la GAUCHE la supprime (règle partagée `decideRowSwipe`) ; la carte ne
 * bouge que par `transform`. À la souris, la corbeille reste un bouton.
 */
export const MirrorNotifRow = memo(function MirrorNotifRow({ notif, selectionMode, isSelected, onPress, onLongPress, onMarkRead, onDelete }: Props) {
  const { t, i18n } = useTranslation("notifications");
  const press = useLongPress(selectionMode ? undefined : onLongPress);
  const body = notifBodyText(notif);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; t: number; width: number; moved: boolean } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (selectionMode || e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, t: e.timeStamp, width: e.currentTarget.offsetWidth, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = e.clientX - d.x;
    if (!d.moved && Math.abs(delta) < ROW_SWIPE_SLOP) return;
    d.moved = true;
    // Une notification lue ne glisse pas vers la droite : il n'y a rien à marquer.
    setDx(notif.read ? Math.min(0, delta) : delta);
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    const elapsed = Math.max(1, e.timeStamp - d.t);
    const action = decideRowSwipe({ dx, vx: dx / elapsed, width: d.width, read: notif.read });
    setDx(0);
    if (action === "delete") onDelete();
    if (action === "markRead") onMarkRead();
  };

  return (
    <div className="relative mb-2 overflow-hidden rounded-xl">
      {dx !== 0 && (
        <div aria-hidden className={`absolute inset-0 flex items-center px-5 ${dx > 0 ? "justify-start bg-[var(--brand-soft)] text-[var(--brand-light)]" : "justify-end bg-danger-surface text-[var(--status-error)]"}`}>
          {dx > 0 ? <CheckCircle size={20} /> : <Trash2 size={20} />}
        </div>
      )}
      <div
        className="relative flex items-stretch gap-2"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 180ms ease-out", touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <button
          type="button"
          {...press.handlers}
          onClick={() => {
            if (!press.consumeClick() && dx === 0) onPress();
          }}
          className="flex min-w-0 flex-1 items-start rounded-xl bg-surface-2 p-4 text-left active:opacity-80"
        >
          {selectionMode ? (
            <span
              className="mr-3 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border-[1.5px]"
              style={{
                borderColor: isSelected ? "rgba(var(--brand-rgb), 0.5)" : "var(--fill-strong)",
                background: isSelected ? "var(--brand-soft)" : "transparent",
              }}
            >
              {isSelected && <Check size={14} className="text-brand-light" aria-hidden />}
            </span>
          ) : !notif.read ? (
            <span
              className="mr-2.5 mt-1.5 h-2 w-2 shrink-0 rounded-full border"
              style={{ background: "rgba(var(--brand-rgb), 0.18)", borderColor: "rgba(var(--brand-rgb), 0.5)" }}
            />
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <span className="min-w-0 flex-1">
            <span className={`block text-sm ${notif.read ? "font-medium text-content-secondary" : "font-semibold text-content-primary"}`}>
              {formatNotifTitle(notif, t)}
            </span>
            {body && <span className="mt-1 line-clamp-2 block text-[13px] leading-[18px] text-content-tertiary">{body}</span>}
            <span className="mt-1.5 flex flex-wrap items-center gap-2">
              <NotifStateBadge state={notif.state} label={(key) => t(key)} />
              <span className="text-xs text-content-quaternary">{agoLabel(notif.createdAt, t, i18n.language)}</span>
            </span>
          </span>
        </button>
        {!selectionMode && (
          // À la souris (survol possible) : la corbeille reste un bouton ; au doigt, on glisse.
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("delete")}
            className="hidden w-11 shrink-0 items-center justify-center rounded-xl bg-fill-subtle text-content-tertiary active:bg-danger-surface [@media(hover:hover)]:flex"
          >
            <Trash2 size={18} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
});
