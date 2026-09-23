import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical, Pin, PinOff } from "lucide-react";
import type { NavEntry } from "./useNavDestinations";

/**
 * Une ligne du panneau « Personnaliser la barre ».
 *
 * Dans la barre : la POIGNÉE seule démarre le glisser (`dragListener` coupé
 * sur la ligne) — un clic sur ↑, ↓ ou l'épingle ne doit jamais déplacer
 * quoi que ce soit par accident. ↑ et ↓ font le même travail au clavier.
 *
 * Hors de la barre : un seul geste, l'épingler (elle rejoint le bout).
 */

const ICON_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-tertiary outline-none transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus disabled:pointer-events-none disabled:opacity-30";

function KindTag({ entry }: { entry: NavEntry }) {
  const { t } = useTranslation("nav");
  if (entry.kind === "core") return null;
  const label = entry.kind === "library" ? t("kindLibrary") : entry.kind === "list" ? t("kindList") : t("kindExtension");
  return <span className="shrink-0 text-[11px] font-medium text-content-quaternary">{label}</span>;
}

export const PinnedRow = memo(function PinnedRow({ entry, first, last, onNudge, onUnpin, onDragEnd }: {
  entry: NavEntry;
  first: boolean;
  last: boolean;
  onNudge: (key: string, delta: -1 | 1) => void;
  onUnpin: (key: string) => void;
  onDragEnd: () => void;
}) {
  const { t } = useTranslation("nav");
  const controls = useDragControls();
  const Icon = entry.icon;
  return (
    <Reorder.Item
      as="li"
      value={entry.key}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02 }}
      className="relative flex h-11 items-center gap-2 rounded-xl border border-line-subtle bg-[color:var(--nav-panel-bg)] pl-1 pr-1.5"
    >
      <button
        type="button"
        aria-label={t("dragToReorder", { name: entry.label })}
        title={t("dragToReorder", { name: entry.label })}
        onPointerDown={(event) => controls.start(event)}
        className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-content-quaternary hover:text-content-secondary active:cursor-grabbing"
        tabIndex={-1}
      >
        <GripVertical aria-hidden className="h-4 w-4" />
      </button>
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-[var(--brand-light)]" strokeWidth={2} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">{entry.label}</span>
      <KindTag entry={entry} />
      <button type="button" className={ICON_BUTTON} disabled={first} aria-label={t("moveUp", { name: entry.label })} title={t("moveUp", { name: entry.label })} onClick={() => onNudge(entry.key, -1)}>
        <ChevronUp aria-hidden className="h-4 w-4" />
      </button>
      <button type="button" className={ICON_BUTTON} disabled={last} aria-label={t("moveDown", { name: entry.label })} title={t("moveDown", { name: entry.label })} onClick={() => onNudge(entry.key, 1)}>
        <ChevronDown aria-hidden className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={`${ICON_BUTTON} hover:bg-danger-surface hover:text-status-error-fg`}
        aria-label={`${t("unpinFromBar")} — ${entry.label}`}
        title={t("unpinFromBar")}
        onClick={() => onUnpin(entry.key)}
      >
        <PinOff aria-hidden className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
});

export const ShelfRow = memo(function ShelfRow({ entry, onPin }: { entry: NavEntry; onPin: (key: string) => void }) {
  const { t } = useTranslation("nav");
  const Icon = entry.icon;
  return (
    <li className="flex h-11 items-center gap-2 rounded-xl pl-3 pr-1.5 transition-colors hover:bg-fill-subtle">
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-content-tertiary" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate text-sm text-content-secondary">{entry.label}</span>
      <KindTag entry={entry} />
      <button
        type="button"
        onClick={() => onPin(entry.key)}
        aria-label={`${t("pinToBar")} — ${entry.label}`}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-soft px-3 text-xs font-semibold text-content-primary outline-none transition-colors hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Pin aria-hidden className="h-3.5 w-3.5" />
        {t("pin")}
      </button>
    </li>
  );
});
