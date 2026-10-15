import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Ban, Bell, CheckCheck, CheckCircle2, ChevronRight, Truck, type LucideIcon } from "lucide-react";
import { Place, sceneTween, type Animated } from "..";
import { CAPSULE } from "../v1_22_0/FauxNavBar";

/** La cloche, posée dans la capsule entre les onglets et la recherche (px du canevas). */
export const BELL_SLOT = { x: CAPSULE.x + CAPSULE.w - 100, y: CAPSULE.y + 10, size: 26 } as const;
/** Le panneau, accroché sous la cloche et aligné sur le bord droit de la capsule. */
export const PANEL = { x: 340, y: 66, w: 288 } as const;
const HEADER_H = 46;
const GROUP_H = 24;
const ROW_H = 58;

/** Le centre de la ligne `index` (dans l'ordre d'affichage), en px du canevas — la cible du pointeur. */
export function notifRowCenter(index: number): { x: number; y: number } {
  const groups = index >= 2 ? 2 : 1;
  return { x: PANEL.x + PANEL.w / 2, y: PANEL.y + HEADER_H + groups * GROUP_H + index * ROW_H + ROW_H / 2 };
}

type Tone = "success" | "info" | "danger";

const TONE: Record<Tone, { fg: string; bg: string; icon: LucideIcon }> = {
  success: { fg: "var(--status-success-fg)", bg: "var(--status-success-bg)", icon: CheckCircle2 },
  info: { fg: "var(--status-info-fg)", bg: "var(--status-info-bg)", icon: Truck },
  danger: { fg: "var(--status-error-fg)", bg: "var(--status-error-bg)", icon: Ban },
};

export interface SceneNotif {
  title: string;
  body: string;
  stateLabel: string;
  tone: Tone;
  ago: string;
  unread: boolean;
}

/** La cloche de la barre et sa pastille du nombre de non lues (`NotificationBell`). */
export function FauxBell({ count, open }: { count: number; open: boolean }) {
  return (
    <Place x={BELL_SLOT.x} y={BELL_SLOT.y} w={BELL_SLOT.size} h={BELL_SLOT.size} style={{ zIndex: 12 }}>
      <span className={`flex h-full w-full items-center justify-center rounded-lg text-content-tertiary ${open ? "bg-fill-soft" : "bg-fill-subtle"}`}>
        <Bell className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      <motion.span
        className="absolute -right-1.5 -top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-cta-brand-fg"
        style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        initial={false}
        animate={{ opacity: count > 0 ? 1 : 0, scale: count > 0 ? 1 : 0.6 }}
        transition={sceneTween}
      >
        {count}
      </motion.span>
    </Place>
  );
}

function Row({ notif, hovered }: { notif: SceneNotif; hovered: boolean }) {
  const tone = TONE[notif.tone];
  const Icon = tone.icon;
  return (
    <div className="relative flex items-start gap-2.5 rounded-lg px-2.5" style={{ height: ROW_H, paddingTop: 8 }}>
      <motion.span className="absolute inset-0 rounded-lg bg-fill-soft" initial={false} animate={{ opacity: hovered ? 1 : 0 }} transition={sceneTween} />
      {notif.unread && <span className="absolute left-0.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[var(--brand)]" />}
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: tone.fg, background: tone.bg }}>
        <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className={`block truncate text-[11px] leading-4 ${notif.unread ? "font-semibold text-content-primary" : "text-content-secondary"}`}>{notif.title}</span>
        <span className="block truncate text-[9.5px] leading-[13px] text-content-tertiary">{notif.body}</span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full px-1.5 text-[8.5px] font-semibold leading-[13px]" style={{ color: tone.fg, background: tone.bg }}>{notif.stateLabel}</span>
          <span className="text-[8.5px] text-content-quaternary">{notif.ago}</span>
        </span>
      </span>
      <ChevronRight className="relative mt-3 h-3 w-3 shrink-0 text-content-disabled" />
    </div>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p className="px-2.5 text-[8.5px] font-semibold uppercase tracking-wider text-content-quaternary" style={{ height: GROUP_H, paddingTop: 10 }}>
      {label}
    </p>
  );
}

/**
 * Le panneau de la cloche, en faux, au balisage de `NotificationPanel` : le
 * titre et les non lues, « Tout marquer lu », puis les notifications par jour
 * — chacune avec l'icône et la pastille de son ÉTAT, un mot, jamais la couleur
 * seule. Recopié, jamais importé : le client LG compile l'écran des nouveautés.
 * Sans le flou (règle du kit).
 */
export function FauxNotificationPanel({ today, earlier, unread, hovered, ...animated }: Animated & {
  today: SceneNotif[];
  earlier: SceneNotif[];
  unread: number;
  hovered: number | null;
}) {
  const { t } = useTranslation("notifications");
  return (
    <Place x={PANEL.x} y={PANEL.y} w={PANEL.w} style={{ transformOrigin: "top right", zIndex: 15 }} {...animated}>
      <div
        className="overflow-hidden rounded-xl pb-1.5"
        style={{ background: "var(--surface-dropdown)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-dropdown)" }}
      >
        <div className="flex items-center border-b border-line-subtle px-3" style={{ height: HEADER_H }}>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-content-primary">{t("title")}</span>
            <span className="block text-[9px] text-content-tertiary">{t("unreadCount", { count: unread })}</span>
          </span>
          <span className="flex items-center gap-1 text-[9.5px] font-semibold text-[var(--brand-light)]">
            <CheckCheck className="h-3 w-3" />
            {t("markAllRead")}
          </span>
        </div>
        <div className="px-1.5">
          <GroupLabel label={t("groupToday")} />
          {today.map((n, i) => <Row key={n.title} notif={n} hovered={hovered === i} />)}
          <GroupLabel label={t("groupEarlier")} />
          {earlier.map((n, i) => <Row key={n.title} notif={n} hovered={hovered === today.length + i} />)}
        </div>
      </div>
    </Place>
  );
}
