import { Fragment, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellOff } from "lucide-react";
import type { NotificationPeriod } from "@tentacle-tv/api-client";
import { BottomSheet } from "../ui/BottomSheet";
import { useFormFactor } from "../useFormFactor";
import { MirrorNotifRow } from "./MirrorNotifRow";
import { NotifSheetHeader } from "./NotifSheetHeader";
import { NotifTabletPanel } from "./NotifTabletPanel";
import { useMirrorNotifCenter } from "./useMirrorNotifCenter";

const PERIOD_KEYS: Record<NotificationPeriod, string> = {
  today: "groupToday",
  yesterday: "groupYesterday",
  week: "groupThisWeek",
  earlier: "groupEarlier",
};

/**
 * La cloche de l'en-tête de l'app : une icône de 21 et sa pastille violette
 * (« 9+ » au-delà), qui ouvre le centre de notifications refait par notifs —
 * la feuille à crans (50 % puis plein écran) sur téléphone, le panneau ancré
 * sous la cloche sur tablette. Filtres « Tout » / « Non lues », périodes
 * (Aujourd'hui, Hier, Cette semaine, Plus tôt), glisser vers la droite pour
 * marquer lue, vers la gauche pour supprimer ; appui long : sélection.
 */
export function MirrorNotificationBell() {
  const { t } = useTranslation("notifications");
  const [open, setOpen] = useState(false);
  const Surface = useFormFactor() === "tablet" ? NotifTabletPanel : BottomSheet;
  const close = useCallback(() => setOpen(false), []);
  const c = useMirrorNotifCenter(open, close);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={c.unread > 0 ? `${t("title")}, ${c.unread}` : t("title")}
        className="mirror-press relative -m-3 flex p-3 text-content-primary"
      >
        <Bell size={21} strokeWidth={2} aria-hidden />
        {c.unread > 0 && (
          <span className="absolute right-[6px] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-cta-brand-fg">
            {c.unread > 9 ? "9+" : c.unread}
          </span>
        )}
      </button>

      <Surface open={open} onClose={close} label={t("title")}>
        <NotifSheetHeader
          filter={c.filter}
          onFilter={c.setFilter}
          unread={c.unread}
          total={c.total}
          shown={c.visible.length}
          selectionMode={c.selectionMode}
          selectedCount={c.selected.size}
          onMarkAll={c.markAll}
          onSelect={() => c.startSelection()}
          onSelectAll={c.selectAll}
          onDeleteAll={c.askDeleteAll}
          onDeleteSelected={c.deleteSelected}
          onCancel={c.exitSelection}
        />
        <div className="px-4 pt-3">
          {c.periods.length === 0 ? (
            <div className="mt-12 flex flex-col items-center gap-2 px-6 text-center">
              <BellOff size={40} className="mb-2 text-content-quaternary" aria-hidden />
              <p className="text-[15px] font-semibold text-content-primary">{t(c.filter === "unread" ? "emptyUnreadTitle" : "emptyTitle")}</p>
              <p className="text-[13px] leading-[18px] text-content-tertiary">{t(c.filter === "unread" ? "emptyUnreadHint" : "emptyHint")}</p>
              {c.filter === "unread" && (
                <button type="button" onClick={() => c.setFilter("all")} className="mt-1 min-h-9 text-[14px] font-semibold text-[var(--brand-light)]">
                  {t("showAll")}
                </button>
              )}
            </div>
          ) : (
            <>
              {c.periods.map(({ group, items }) => (
                <Fragment key={group}>
                  <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wider text-content-quaternary">{t(PERIOD_KEYS[group])}</p>
                  {items.map((n) => (
                    <MirrorNotifRow
                      key={n.id}
                      notif={n}
                      selectionMode={c.selectionMode}
                      isSelected={c.selected.has(n.id)}
                      onPress={() => (c.selectionMode ? c.toggle(n.id) : c.openOne(n))}
                      onLongPress={() => c.startSelection(n.id)}
                      onMarkRead={() => c.markRead(n.id)}
                      onDelete={() => c.remove(n.id)}
                    />
                  ))}
                </Fragment>
              ))}
              {!c.selectionMode && <p className="mb-2 mt-3 text-center text-[11.5px] text-content-quaternary">{t("swipeHintBoth")}</p>}
            </>
          )}
        </div>
      </Surface>
    </>
  );
}
