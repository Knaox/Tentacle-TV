import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Trash2 } from "lucide-react";
import { formatNotifTitle, notifBodyText, type AppNotification } from "@tentacle-tv/api-client";
import { useLongPress } from "../ui/useLongPress";

function formatAgo(dateStr: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  return t("daysAgo", { count: Math.floor(hours / 24) });
}

interface Props {
  notif: AppNotification;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}

/**
 * Une notification (`SwipeableNotifRow` de l'app) : carte `surface.s2` de rayon
 * 12, point violet des non lues, titre 14, corps 13 sur deux lignes, date 12.
 * Le balayage de l'app devient un bouton de suppression discret.
 */
export const MirrorNotifRow = memo(function MirrorNotifRow({ notif, selectionMode, isSelected, onPress, onLongPress, onDelete }: Props) {
  const { t } = useTranslation("notifications");
  const press = useLongPress(selectionMode ? undefined : onLongPress);
  const body = notifBodyText(notif);

  return (
    <div className="relative mb-2 flex items-stretch gap-2">
      <button
        type="button"
        {...press.handlers}
        onClick={() => {
          if (!press.consumeClick()) onPress();
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
          <span className="mt-1.5 block text-xs text-content-quaternary">{formatAgo(notif.createdAt, t)}</span>
        </span>
      </button>
      {!selectionMode && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("delete")}
          className="flex w-11 shrink-0 items-center justify-center rounded-xl bg-fill-subtle text-content-tertiary active:bg-danger-surface"
        >
          <Trash2 size={18} aria-hidden />
        </button>
      )}
    </div>
  );
});
